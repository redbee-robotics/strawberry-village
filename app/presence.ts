import { getApp, getApps, initializeApp } from "firebase/app";
import { browserSessionPersistence, getAuth, initializeAuth, signInAnonymously } from "firebase/auth";
import { getDatabase, onDisconnect, onValue, ref, remove, serverTimestamp, set, type DatabaseReference } from "firebase/database";
import { firebaseConfig } from "./firebase-config";
import { activeVillagePlayers, villagePlayersPath, type VillagePlayers } from "./presence-state";
import type { FarmWorld } from "./world";

export function connectVillage(world: FarmWorld, onStatus: (total: number | null) => void) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  let auth;
  try { auth = initializeAuth(app, { persistence: browserSessionPersistence }); } catch { auth = getAuth(app); }
  const database = getDatabase(app);
  const playersPath = villagePlayersPath(window.location.hostname);
  const session = crypto.randomUUID();
  const names = ["햇살 한 줌", "느긋한 딸기", "초록빛 산책", "달콤한 바람", "이슬 맺힌 새싹", "작은 들꽃", "포근한 구름", "딸기향 오후", "산들바람", "아침 이슬", "싱그러운 잎새", "고요한 숲길", "반짝이는 열매", "초록 모자", "따뜻한 햇볕", "딸기 한 알", "풀잎 위 이슬", "가벼운 발걸음", "노을빛 마당", "반가운 봄비", "수줍은 새싹", "바람 속 들꽃", "열매 맺는 하루", "봄을 기다리는 씨앗"];
  let name = names[Math.floor(Math.random() * names.length)];
  try {
    const remembered = sessionStorage.getItem("strawberry-farmer-name-v1");
    if (remembered && names.includes(remembered)) name = remembered;
    else sessionStorage.setItem("strawberry-farmer-name-v1", name);
  } catch { /* The farm also works when session storage is unavailable. */ }
  world.setName(name);
  let disposed = false, present = true, connected = false, sending = false, published = false, readable = false, lastSent = 0, lastPose = "", offset = 0, retryAfter = 0;
  let disconnectTimer = 0;
  let shownStatus: number | null = null;
  function reportStatus(total: number | null) {
    if (disposed) return;
    if (total !== null) { window.clearTimeout(disconnectTimer); disconnectTimer = 0; if (shownStatus !== total) { shownStatus = total; onStatus(total); } }
    else if (!disconnectTimer) disconnectTimer = window.setTimeout(() => { disconnectTimer = 0; if (!disposed && shownStatus !== null) { shownStatus = null; onStatus(null); } }, 3000);
  }
  let ownRef: DatabaseReference | null = null;
  let timer = 0;
  let latestPlayers: VillagePlayers = {};
  const unsubscribe: (() => void)[] = [];

  function renderPlayers() {
    if (disposed) return;
    const players = activeVillagePlayers(latestPlayers, Date.now() + offset);
    world.setPlayers(players.filter((player) => player.id !== session));
    reportStatus(connected && published && readable && players.some((player) => player.id === session) ? players.length : null);
  }

  async function publish(force = false) {
    if (disposed || !present || !connected || !ownRef || sending || Date.now() < retryAfter) return;
    const pose = world.getPose();
    const compact = JSON.stringify({ ...pose, x: Math.round(pose.x * 100) / 100, z: Math.round(pose.z * 100) / 100, angle: Math.round(pose.angle * 100) / 100 });
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
  const leave = () => { present = false; if (ownRef) void remove(ownRef).catch(() => {}); };
  const enter = () => { if (!disposed) { present = true; void publish(true); } };

  void (async () => {
    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);
    if (disposed || !auth.currentUser) return;
    ownRef = ref(database, `${playersPath}/${auth.currentUser.uid}/${session}`);
    unsubscribe.push(onValue(ref(database, ".info/serverTimeOffset"), (snapshot) => { offset = snapshot.val() || 0; }));
    unsubscribe.push(onValue(ref(database, ".info/connected"), async (snapshot) => {
      if (disposed) return;
      connected = snapshot.val() === true;
      if (!connected) { if (!disposed) { world.setPlayers([]); published = false; retryAfter = Date.now() + 5000; reportStatus(null); } return; }
      try {
        await onDisconnect(ownRef!).remove();
        if (!disposed) await publish(true);
      } catch { if (!disposed) { published = false; retryAfter = Date.now() + 5000; reportStatus(null); } }
    }));
    unsubscribe.push(onValue(ref(database, playersPath), (snapshot) => { readable = true; latestPlayers = snapshot.val() || {}; renderPlayers(); }, () => { readable = false; reportStatus(null); }));
    timer = window.setInterval(() => { void publish(); renderPlayers(); }, 220);
    document.addEventListener("visibilitychange", visibility); window.addEventListener("pagehide", leave); window.addEventListener("pageshow", enter);
  })().catch(() => { if (!disposed) reportStatus(null); });

  return () => {
    disposed = true; leave(); window.clearInterval(timer); window.clearTimeout(disconnectTimer); unsubscribe.forEach((stop) => stop());
    document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", leave); window.removeEventListener("pageshow", enter);
  };
}
