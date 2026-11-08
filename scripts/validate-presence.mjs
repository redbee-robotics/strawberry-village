import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
const compile = (name) => ts.transpileModule(fs.readFileSync(new URL(`../app/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = async (name) => import(`data:text/javascript;base64,${Buffer.from(compile(name)).toString("base64")}`);
const names = await module("nicknames"), chat = await module("chat"), poses = await module("presence-pose"), locations = await module("locations");
const store = {}, listeners = new Set(), timers = new Map();
let authIndex = 0, timerIndex = 0, now = Date.now();
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
  set: async (path, value) => { write(path, value); emit(path); }, remove: async (path) => { write(path, null); emit(path); },
  firebaseConfig: {}, ...names, ...chat, ...poses, ...locations,
};
globalThis.window = { setInterval: (callback) => { timers.set(++timerIndex, callback); return timerIndex; }, clearInterval: (id) => timers.delete(id), setTimeout: () => ++timerIndex, clearTimeout: () => {}, addEventListener: () => {}, removeEventListener: () => {} };
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
  console.log("Presence integration passed with simulated Firebase transport: three visitors, unique names, rejected duplicate rename, group speech, distance/room filtering, cooldown, bubble expiry and disconnect cleanup.");
} finally { for (const stop of connections) stop(); Date.now = originalNow; delete globalThis.window; delete globalThis.document; delete globalThis.sessionStorage; }
