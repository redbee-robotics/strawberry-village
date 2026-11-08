import { getApp, getApps, initializeApp } from "firebase/app";
import { browserSessionPersistence, getAuth, initializeAuth, signInAnonymously } from "firebase/auth";
import { getDatabase, onDisconnect, onValue, ref, remove, serverTimestamp, set, type DatabaseReference } from "firebase/database";
import { firebaseConfig } from "./firebase-config";
import type { FarmWorld, RemotePlayer } from "./world";
import { cleanNickname, sessionNicknames, unusedNickname } from "./nicknames";
import { decodePosition, encodePosition } from "./presence-pose";

export function connectVillage(world: FarmWorld, onStatus: (total: number | null) => void, onName: (name: string) => void = () => {}) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  let auth;
  try { auth = initializeAuth(app, { persistence: browserSessionPersistence }); } catch { auth = getAuth(app); }
  const database = getDatabase(app);
  // Normalize versioned wire coordinates to fit the existing database's numeric limits.
  const session = `v2-${Date.now()}-${crypto.randomUUID()}`;
  const names = ["햇살 한 줌", "느긋한 딸기", "초록빛 산책", "달콤한 바람", "이슬 맺힌 새싹", "작은 들꽃", "포근한 구름", "딸기향 오후", "산들바람", "아침 이슬", "싱그러운 잎새", "고요한 숲길", "반짝이는 열매", "초록 모자", "따뜻한 햇볕", "딸기 한 알", "풀잎 위 이슬", "가벼운 발걸음", "노을빛 마당", "반가운 봄비", "수줍은 새싹", "바람 속 들꽃", "열매 맺는 하루", "봄을 기다리는 씨앗"];
  let name = names[Math.floor(Math.random() * names.length)];
  try {
    const remembered = sessionStorage.getItem("strawberry-farmer-name-v1");
    if (remembered && cleanNickname(remembered) && remembered.length <= 16) name = remembered;
    else sessionStorage.setItem("strawberry-farmer-name-v1", name);
  } catch { /* The farm also works when session storage is unavailable. */ }
  world.setName(name);
  onName(name);
  let disposed = false, connected = false, sending = false, published = false, readable = false, lastSent = 0, lastPose = "", offset = 0, retryAfter = 0;
  let disconnectTimer = 0;
  let disconnectReady = false;
  let shownStatus: number | null = null;
  function reportStatus(total: number | null) {
    if (disposed) return;
    if (total !== null) { window.clearTimeout(disconnectTimer); disconnectTimer = 0; if (shownStatus !== total) { shownStatus = total; onStatus(total); } }
    else if (!disconnectTimer) disconnectTimer = window.setTimeout(() => { disconnectTimer = 0; if (!disposed && shownStatus !== null) { shownStatus = null; onStatus(null); } }, 3000);
  }
  let ownRef: DatabaseReference | null = null;
  let timer = 0;
  let latestPlayers: Record<string, Record<string, RemotePlayer & { updatedAt: number }>> = {};
  const unsubscribe: (() => void)[] = [];

  function renderPlayers() {
    if (disposed) return;
    const now = Date.now() + offset;
    const players = Object.values(latestPlayers).flatMap((sessions) => Object.values(sessions || {})).filter((player) => player && now - player.updatedAt < 125000 && [player.x, player.z, player.angle].every(Number.isFinite)).map((player) => player.id === session ? { ...player, name } : player);
    const assigned = sessionNicknames(players);
    const taken = new Set([...assigned].filter(([id]) => id !== session).map(([, value]) => value.toLowerCase()));
    const nextName = assigned.get(session) || unusedNickname(name, taken);
    if (name !== nextName) { name = nextName; world.setName(name); onName(name); lastPose = ""; try { sessionStorage.setItem("strawberry-farmer-name-v1", name); } catch {} }
    world.setPlayers(players.filter((player) => player.id !== session).map((player) => ({ ...player, name: assigned.get(player.id) || player.name, ...decodePosition(player.id, player.x, player.z) })));
    reportStatus(connected && published && readable && players.some((player) => player.id === session) ? players.length : null);
  }

  async function publish(force = false) {
    if (disposed || !connected || !disconnectReady || !readable || !ownRef || sending || Date.now() < retryAfter) return;
    const pose = world.getPose();
    const compact = JSON.stringify({ ...pose, ...encodePosition(pose.x, pose.z), angle: Math.round(pose.angle * 100) / 100 });
    const now = Date.now();
    if (!force && compact === lastPose && now - lastSent < 5000) return;
    sending = true;
    try {
      await set(ownRef, { id: session, name, ...JSON.parse(compact), updatedAt: serverTimestamp() });
      lastPose = compact; lastSent = now; published = true; renderPlayers();
    } catch { if (!disposed) { published = false; retryAfter = Date.now() + 5000; reportStatus(null); } }
    finally { sending = false; }
  }

  const visibility = () => {
    if (!document.hidden) void publish(true);
  };
  const leave = () => { if (ownRef) void remove(ownRef); };

  void (async () => {
    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);
    if (disposed || !auth.currentUser) return;
    ownRef = ref(database, `village/players/${auth.currentUser.uid}/${session}`);
    unsubscribe.push(onValue(ref(database, ".info/serverTimeOffset"), (snapshot) => { offset = snapshot.val() || 0; }));
    unsubscribe.push(onValue(ref(database, ".info/connected"), async (snapshot) => {
      connected = snapshot.val() === true;
      if (!connected) { disconnectReady = false; if (!disposed) { world.setPlayers([]); published = false; retryAfter = Date.now() + 5000; reportStatus(null); } return; }
      try {
        await onDisconnect(ownRef!).remove();
        disconnectReady = true;
        if (!disposed) await publish(true);
      } catch { if (!disposed) { published = false; retryAfter = Date.now() + 5000; reportStatus(null); } }
    }));
    unsubscribe.push(onValue(ref(database, "village/players"), (snapshot) => { readable = true; latestPlayers = snapshot.val() || {}; renderPlayers(); if (connected && !published) void publish(true); }, () => { readable = false; reportStatus(null); }));
    timer = window.setInterval(() => { void publish(); renderPlayers(); }, 220);
    document.addEventListener("visibilitychange", visibility); window.addEventListener("pagehide", leave);
  })().catch(() => { if (!disposed) reportStatus(null); });

  const dispose = () => {
    disposed = true; leave(); window.clearInterval(timer); window.clearTimeout(disconnectTimer); unsubscribe.forEach((stop) => stop());
    document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", leave);
  };
  dispose.changeName = (requested: string) => {
    const desired = cleanNickname(requested);
    if (!desired || desired.length > 16) return { ok: false, message: "닉네임은 1~16자로 입력해 주세요." };
    if (!connected || !readable || disposed) return { ok: false, message: "마을에 연결된 뒤 다시 변경해 주세요." };
    const active = Object.values(latestPlayers).flatMap((sessions) => Object.values(sessions || {})).filter((player) => player && player.id !== session && Date.now() + offset - player.updatedAt < 125000);
    const taken = new Set([...sessionNicknames(active).values()].map((value) => value.toLowerCase()));
    if (taken.has(desired.toLowerCase())) return { ok: false, message: "다른 방문자가 사용 중인 닉네임이에요." };
    name = desired; lastPose = ""; world.setName(name); onName(name);
    try { sessionStorage.setItem("strawberry-farmer-name-v1", name); } catch {}
    void publish(true);
    return { ok: true, message: "닉네임을 변경했어요." };
  };
  return dispose;
}
