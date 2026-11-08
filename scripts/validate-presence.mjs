import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
const compile = (name) => ts.transpileModule(fs.readFileSync(new URL(`../app/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = async (name) => import(`data:text/javascript;base64,${Buffer.from(compile(name)).toString("base64")}`);
const names = await module("nicknames"), chat = await module("chat"), poses = await module("presence-pose"), locations = await module("locations");
const presence = await module("presence-state");
const store = {}, listeners = new Set(), timers = new Map();
let authIndex = 0, timerIndex = 0, now = Date.now();
let pauseSpeech = false, completeSpeech;
const originalNow = Date.now;
Date.now = () => now;
const read = (path) => path.split("/").reduce((value, key) => value?.[key], store) ?? null;
function write(path, value) { const parts = path.split("/"); let parent = store; for (const part of parts.slice(0, -1)) parent = parent[part] ||= {}; if (value === null) delete parent[parts.at(-1)]; else parent[parts.at(-1)] = value; }
function emit(changed) { for (const listener of [...listeners]) if (listener.path === changed || changed.startsWith(listener.path + "/") || listener.path.startsWith(changed + "/")) listener.callback({ val: () => structuredClone(read(listener.path)) }); }
const bindings = {
  getApps: () => [], getApp: () => ({}), initializeApp: () => ({}), getAuth: () => ({}), browserSessionPersistence: {},
  initializeAuth: () => ({ currentUser: { uid: `visitor-${++authIndex}` }, authStateReady: async () => {} }), signInAnonymously: async () => {},
  getDatabase: () => ({}), ref: (_, path) => path,
  onValue: (path, callback) => { const listener = { path, callback }; listeners.add(listener); callback({ val: () => path === ".info/connected" ? true : path === ".info/serverTimeOffset" ? 0 : structuredClone(read(path)) }); return () => listeners.delete(listener); },
  onDisconnect: () => ({ remove: async () => {} }),
  serverTimestamp: () => now,
  set: async (path, value) => { if (pauseSpeech && path.includes("/speech/")) await new Promise(resolve => { completeSpeech = resolve; }); write(path, value); emit(path); }, remove: async (path) => { write(path, null); emit(path); },
  firebaseConfig: {}, ...names, ...chat, ...poses, ...locations, ...presence,
};
globalThis.window = { location: { hostname: "localhost" }, setInterval: (callback) => { timers.set(++timerIndex, callback); return timerIndex; }, clearInterval: (id) => timers.delete(id), setTimeout: () => ++timerIndex, clearTimeout: () => {}, addEventListener: () => {}, removeEventListener: () => {} };
globalThis.document = { hidden: false, addEventListener: () => {}, removeEventListener: () => {} };
const memory = new Map(); globalThis.sessionStorage = { getItem: (key) => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
const source = compile("presence").replace(/^import .*;\n/gm, "").replace("export function connectVillage", "function connectVillage");
const connect = new Function(...Object.keys(bindings), source + "\nreturn connectVillage;")(...Object.values(bindings));
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const worlds = [], connections = [];
function world(x) { const state = { pose: { x, z: 9, angle: 0, action: "walk", basket: 0, room: "outside" }, remotes: [], speech: "", conversation: null, name: "", count: null };
  state.getPose = () => state.pose; state.setName = (name) => state.name = name; state.setPlayers = (players) => state.remotes = players; state.setLocalSpeech = (text) => state.speech = text; state.nearbyVisitors = () => state.remotes.filter((remote) => chat.canHear(state.pose, remote)); worlds.push(state); return state;
}
try {
  for (let i = 0; i < 10; i++) write(`village/players/legacy/old-${i}`, { id: `old-${i}`, name: "산들바람", x: 0, z: 9, angle: 0, action: "walk", basket: 0, updatedAt: now });
  for (const x of [0, 1, 2]) { const next = world(x); connections.push(connect(next, (count) => next.count = count, (name) => next.name = name, (state) => next.conversation = state)); }
  await flush();
  assert.ok(worlds.every((state) => state.count === 3 && state.conversation.ready));
  assert.equal(new Set(worlds.map((state) => state.name)).size, 3);
  assert.equal(connections[1].changeName(worlds[0].name).ok, false);
  assert.equal(connections[1].changeName("새로운 별빛").ok, true); await flush();
  assert.equal((await connections[0].say("안녕하세요!")).ok, true); await flush();
  assert.ok(worlds.every((state) => state.conversation.messages.some((message) => message.text === "안녕하세요!")));
  assert.equal(worlds[0].speech, "안녕하세요!");
  assert.ok(worlds[1].remotes.some((remote) => remote.speech === "안녕하세요!"));
  assert.equal((await connections[0].say("너무 빠른 메시지")).ok, false);
  worlds[2].pose.x = 50; for (const tick of [...timers.values()]) tick(); await flush();
  assert.equal((await connections[2].say("멀리서 전송")).ok, false);
  now += 1100; assert.equal((await connections[0].say("가까운 이웃에게만")).ok, true); await flush();
  assert.ok(!worlds[2].conversation.messages.some((message) => message.text === "가까운 이웃에게만"));
  worlds[2].pose.x = 2; worlds[2].pose.room = "cafe"; for (const tick of [...timers.values()]) tick(); await flush();
  now += 1100; await connections[0].say("같은 공간에서만"); await flush();
  assert.ok(!worlds[2].conversation.messages.some((message) => message.text === "같은 공간에서만"));
  now += chat.SPEECH_LIFETIME + 1; for (const tick of [...timers.values()]) tick(); await flush();
  assert.equal(worlds[0].speech, ""); assert.ok(worlds[1].remotes.every((remote) => !remote.speech));
  connections[2](); await flush(); assert.equal(worlds[0].count, 2);
  window.location.hostname = "strawberry-village.web.app";
  for (const x of [0, 1]) { const next = world(x); connections.push(connect(next, (count) => next.count = count, (name) => next.name = name, (state) => next.conversation = state)); }
  window.location.hostname = "localhost";
  await flush();
  assert.ok(worlds.slice(0, 2).every((state) => state.count === 2 && state.remotes.length === 1));
  assert.ok(worlds.slice(3).every((state) => state.count === 2 && state.remotes.length === 1 && state.conversation.ready));
  assert.equal(connections[0].changeName("두 마을 같은 이름").ok, true); await flush();
  assert.equal(connections[3].changeName("두 마을 같은 이름").ok, true); await flush();
  assert.equal((await connections[3].say("운영 마을에서만")).ok, true); await flush();
  assert.ok(worlds.slice(3).every((state) => state.conversation.messages.some((message) => message.text === "운영 마을에서만")));
  assert.ok(worlds.slice(0, 2).every((state) => !state.conversation.messages.some((message) => message.text === "운영 마을에서만")));
  now += 1100; assert.equal((await connections[0].say("개발 마을에서만")).ok, true); await flush();
  assert.ok(worlds.slice(3).every((state) => !state.conversation.messages.some((message) => message.text === "개발 마을에서만")));
  connections[3](); connections[4](); await flush();
  assert.ok(worlds.slice(0, 2).every((state) => state.count === 2));
  now += 1100; pauseSpeech = true;
  const pendingSpeech = connections[0].say("종료 중인 말풍선"); await flush();
  assert.ok(completeSpeech); connections[0](); pauseSpeech = false; completeSpeech();
  assert.equal((await pendingSpeech).ok, false); await flush();
  assert.deepEqual(Object.keys(read(`${presence.villagePresencePaths("localhost").speech}/visitor-1`) || {}), []);
  console.log("Presence integration passed with simulated Firebase transport: unique names, rename rejection, group speech, distance/room filtering, cooldown, bubble expiry, disconnect cleanup, legacy exclusion and production/development player and speech isolation.");
} finally { for (const stop of connections) stop(); Date.now = originalNow; delete globalThis.window; delete globalThis.document; delete globalThis.sessionStorage; }
