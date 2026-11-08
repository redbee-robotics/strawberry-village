import { getApp, getApps, initializeApp } from "firebase/app";
import { browserSessionPersistence, getAuth, initializeAuth, signInAnonymously } from "firebase/auth";
import { getDatabase, onDisconnect, onValue, ref, remove, serverTimestamp, set, type DatabaseReference } from "firebase/database";
import { firebaseConfig } from "./firebase-config";
import type { FarmWorld, RemotePlayer } from "./world";
import { cleanNickname, nicknameChoice, sessionNicknames, suggestedNicknames, unusedNickname } from "./nicknames";
import { canHear, cleanSpeech, hasTestNeighbor, MAX_SPEECH_LENGTH, readSpeech, type Speech, type Conversation, type ConversationMessage } from "./chat";
import { HOUSE_CENTERS } from "./locations";
import { decodePosition, encodePosition } from "./presence-pose";
import { activeVillagePlayers, villagePresencePaths, type VillagePlayers } from "./presence-state";

export function connectVillage(world: FarmWorld, onStatus: (total: number | null) => void, onName: (name: string) => void = () => {}, onConversation: (state: Conversation) => void = () => {}) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  let auth;
  try { auth = initializeAuth(app, { persistence: browserSessionPersistence }); } catch { auth = getAuth(app); }
  const database = getDatabase(app);
  const { players: playersPath, speech: speechPath } = villagePresencePaths(window.location.hostname);
  const previewNeighbor = hasTestNeighbor(window.location.hostname, window.location.pathname || "");
  const nicknameStorageKey = "strawberry-farmer-name-v2";
  // Normalize versioned wire coordinates to fit the existing database's numeric limits.
  const session = `v2-${Date.now()}-${crypto.randomUUID()}`;

  let name: string = suggestedNicknames[Math.floor(Math.random() * suggestedNicknames.length)];
  try {
    let remembered = sessionStorage.getItem(nicknameStorageKey);
    if (!remembered) {
      remembered = sessionStorage.getItem("strawberry-farmer-name-v1");
      if (remembered) {
        const oldBase = remembered.replace(/ \d+$/, "");
        if (oldBase !== remembered && suggestedNicknames.some((candidate) => candidate === oldBase)) remembered = oldBase;
      }
    }
    if (remembered && cleanNickname(remembered) && remembered.length <= 16) name = remembered;
    sessionStorage.setItem(nicknameStorageKey, name);
  } catch { /* The farm also works when session storage is unavailable. */ }
  world.setName(name);
  onName(name);
  let disposed = false, present = true, connected = false, sending = false, published = false, readable = false, lastSent = 0, lastPose = "", offset = 0, retryAfter = 0;
  let disconnectTimer = 0;
  let disconnectReady = false;
  let shownStatus: number | null = null;
  function reportStatus(total: number | null) {
    if (disposed) return;
    if (total !== null) { window.clearTimeout(disconnectTimer); disconnectTimer = 0; if (shownStatus !== total) { shownStatus = total; onStatus(total); } }
    else if (!disconnectTimer) disconnectTimer = window.setTimeout(() => { disconnectTimer = 0; if (!disposed && shownStatus !== null) { shownStatus = null; onStatus(null); } }, 3000);
  }
  let ownRef: DatabaseReference | null = null, speechRef: DatabaseReference | null = null;
  let speechReadable = false, speechUnavailable = false, lastConversation = "", lastSpeech = 0;
  let latestSpeech: Record<string, Record<string, unknown>> = {};
  const heard = new Map<string, ConversationMessage>();
  let timer = 0, speechSending = false;
  let previewOwnSpeech: Speech | null = null, previewReply: Speech | null = null;
  let latestPlayers: VillagePlayers = {};
  const unsubscribe: (() => void)[] = [];

  function renderPlayers() {
    if (disposed) return;
    const now = Date.now() + offset;
    const players = activeVillagePlayers(latestPlayers, now).map((player) => player.id === session ? { ...player, name } : player);
    const assigned = sessionNicknames(players);
    const taken = new Set([...assigned].filter(([id]) => id !== session).map(([, value]) => value.toLowerCase()));
    const nextName = assigned.get(session) || unusedNickname(name, taken);
    if (name !== nextName) { name = nextName; world.setName(name); onName(name); lastPose = ""; try { sessionStorage.setItem(nicknameStorageKey, name); } catch {} }
    const pose = world.getPose();
    const remotes: RemotePlayer[] = players.filter((player) => player.id !== session).map((player) => {
      const point = decodePosition(player.id, player.x, player.z);
      const extraHouse = HOUSE_CENTERS.findIndex(([x, z], index) => index >= 4 && Math.abs(point.x - x) < 3.4 && Math.abs(point.z - z) < 6.35);
      const room = extraHouse >= 4 && player.room === "outside" ? `house-${extraHouse}` as RemotePlayer["room"] : player.room;
      const speech = canHear(pose, { ...point, room }) ? readSpeech(latestSpeech[player.uid]?.[player.id], now) : null;
      const displayName = assigned.get(player.id) || player.name;
      if (speech) heard.set(`${player.id}-${speech.createdAt}`, { ...speech, id: player.id, name: displayName, self: false });
      return { ...player, ...point, room, name: displayName, speech: speech?.text || "" };
    });
    const own = players.find((player) => player.id === session);
    const tester = previewNeighbor ? world.getTestNeighbor() : null;
    if (tester) {
      const reply = readSpeech(previewReply, now);
      remotes.push({ ...tester, speech: reply?.text || "" });
      if (reply) heard.set(`${tester.id}-${reply.createdAt}`, { ...reply, id: tester.id, name: tester.name, self: false });
    }
    const ownSpeech = readSpeech(previewOwnSpeech, now) || (own ? readSpeech(latestSpeech[own.uid]?.[session], now) : null);
    if (ownSpeech) heard.set(`${session}-${ownSpeech.createdAt}`, { ...ownSpeech, id: session, name, self: true });
    world.setLocalSpeech(ownSpeech?.text || "");
    world.setPlayers(remotes);
    for (const [key, message] of heard) if (now - message.createdAt > 300000) heard.delete(key);
    const messages = [...heard.values()].sort((a, b) => a.createdAt - b.createdAt).slice(-50);
    const conversation = { ready: !!tester || (connected && published && speechReadable), unavailable: speechUnavailable && !tester, messages };
    const serialized = JSON.stringify(conversation);
    if (serialized !== lastConversation) { lastConversation = serialized; onConversation(conversation); }
    reportStatus(connected && published && readable && players.some((player) => player.id === session) ? players.length : null);
  }

  async function publish(force = false) {
    if (disposed || !present || !connected || !disconnectReady || !readable || !ownRef || sending || Date.now() < retryAfter) return;
    const pose = world.getPose();
    const compact = JSON.stringify({ ...pose, ...encodePosition(pose.x, pose.z), room: pose.room === "house-4" || pose.room === "house-5" ? "outside" : pose.room, angle: Math.round(pose.angle * 100) / 100 });
    const now = Date.now();
    if (!force && compact === lastPose && now - lastSent < 5000) return;
    sending = true;
    try {
      await set(ownRef, { id: session, name, ...JSON.parse(compact), updatedAt: serverTimestamp() });
      if (disposed || !present) { await remove(ownRef); return; }
      lastPose = compact; lastSent = now; published = true; renderPlayers();
    } catch { if (!disposed) { published = false; retryAfter = Date.now() + 5000; reportStatus(null); } }
    finally { sending = false; }
  }

  const visibility = () => {
    if (!document.hidden) void publish(true);
  };
  const leave = () => { present = false; if (ownRef) void remove(ownRef).catch(() => {}); if (speechRef && speechReadable) void remove(speechRef).catch(() => {}); };
  const enter = () => { if (!disposed) { present = true; void publish(true); } };

  timer = window.setInterval(() => { void publish(); renderPlayers(); }, 220);
  renderPlayers();
  void (async () => {
    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);
    if (disposed || !auth.currentUser) return;
    ownRef = ref(database, `${playersPath}/${auth.currentUser.uid}/${session}`);
    speechRef = ref(database, `${speechPath}/${auth.currentUser.uid}/${session}`);
    unsubscribe.push(onValue(ref(database, speechPath), (snapshot) => { latestSpeech = snapshot.val() || {}; speechReadable = true; speechUnavailable = false; renderPlayers(); }, () => { speechReadable = false; speechUnavailable = true; renderPlayers(); }));
    unsubscribe.push(onValue(ref(database, ".info/serverTimeOffset"), (snapshot) => { offset = snapshot.val() || 0; }));
    unsubscribe.push(onValue(ref(database, ".info/connected"), async (snapshot) => {
      if (disposed) return;
      connected = snapshot.val() === true;
      if (!connected) { disconnectReady = false; if (!disposed) { world.setPlayers([]); published = false; retryAfter = Date.now() + 5000; reportStatus(null); } return; }
      try {
        await onDisconnect(ownRef!).remove();
        if (speechRef) void onDisconnect(speechRef).remove().catch(() => {});
        disconnectReady = true;
        if (!disposed) await publish(true);
      } catch { if (!disposed) { published = false; retryAfter = Date.now() + 5000; reportStatus(null); } }
    }));
    unsubscribe.push(onValue(ref(database, playersPath), (snapshot) => { readable = true; latestPlayers = snapshot.val() || {}; renderPlayers(); if (connected && !published) void publish(true); }, () => { readable = false; reportStatus(null); }));
    document.addEventListener("visibilitychange", visibility); window.addEventListener("pagehide", leave); window.addEventListener("pageshow", enter);
  })().catch(() => { if (!disposed) reportStatus(null); });

  const dispose = () => {
    disposed = true; leave(); window.clearInterval(timer); window.clearTimeout(disconnectTimer); unsubscribe.forEach((stop) => stop());
    document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", leave); window.removeEventListener("pageshow", enter);
  };
  dispose.changeName = (requested: string) => {
    const desired = cleanNickname(requested);
    if (!desired || desired.length > 16) return { ok: false, message: "닉네임은 1~16자로 입력해 주세요." };
    if (!connected || !readable || disposed || !present) return { ok: false, message: "마을에 연결된 뒤 다시 변경해 주세요." };
    const active = activeVillagePlayers(latestPlayers, Date.now() + offset).filter((player) => player.id !== session);
    const taken = new Set([...sessionNicknames(active).values()].map((value) => value.toLowerCase()));
    const choice = nicknameChoice(desired, taken);
    if (!choice.ok) return choice;
    name = desired; lastPose = ""; world.setName(name); onName(name);
    try { sessionStorage.setItem(nicknameStorageKey, name); } catch {}
    void publish(true);
    return { ok: true, message: "닉네임을 변경했어요." };
  };
  dispose.say = async (requested: string) => {
    const text = cleanSpeech(requested);
    if (!text || text.length > MAX_SPEECH_LENGTH) return { ok: false, message: `메시지는 1~${MAX_SPEECH_LENGTH}자로 입력해 주세요.` };
    const live = connected && published && speechReadable && speechRef;
    const tester = previewNeighbor ? world.getTestNeighbor() : null;
    if ((!live && !tester) || disposed || !present) return { ok: false, message: "지금은 대화에 연결할 수 없어요. 잠시 후 다시 시도해 주세요." };
    if (!world.nearbyVisitors().length) return { ok: false, message: "가까운 이웃에게 다가가 주세요." };
    if (speechSending || Date.now() - lastSpeech < 1000) return { ok: false, message: "잠깐 기다렸다가 이야기해 주세요." };
    lastSpeech = Date.now(); speechSending = true;
    // A server-adjusted numeric timestamp stays identical in the optimistic event and acknowledgement.
    // serverTimestamp() changes between those events and would add the same line twice to heard.
    const speech = { text, createdAt: Math.round(Date.now() + offset) };
    try {
      if (live) { previewOwnSpeech = null; await set(speechRef!, speech); }
      else previewOwnSpeech = speech;
      if (disposed || !present) { if (live) await remove(speechRef!); return { ok: false, message: "마을에 다시 연결한 뒤 이야기해 주세요." }; }
      if (tester) previewReply = { text: "안녕하세요! 저는 채팅 테스트 이웃이에요.", createdAt: speech.createdAt + 1 };
      renderPlayers();
      return { ok: true, message: "" };
    }
    catch { return { ok: false, message: "말을 전하지 못했어요. 잠시 후 다시 시도해 주세요." }; }
    finally { speechSending = false; }
  };
  return dispose;
}
