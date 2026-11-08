import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";

async function moduleUrl(name) {
  let js = ts.transpileModule(fs.readFileSync(new URL(`../app/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const match of [...js.matchAll(/from "\.\/(.*?)"/g)]) js = js.replaceAll(`from "./${match[1]}"`, `from "${await moduleUrl(match[1])}"`);
  return `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
}
const { connectJeojatFarmer } = await import(await moduleUrl("jeojat-farmer"));
const globals = ["window", "document"];
const previous = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const timers = new Set(), events = new Map(), writes = [];
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const position = (x, updatedAt) => JSON.stringify({ version: 2, x, z: 9, updatedAt });
let state = position(0, 0), server = position(10, 100), finishRead, failRead = false, names = [];
const sdk = { site: "pYUoDazk7y", user: { uid: "account-a", nick: "저잣거리 농부" }, ready: Promise.resolve(),
  on(type, callback) { if (!events.has(type)) events.set(type, []); events.get(type).push(callback); },
  async get() { if (failRead) throw new Error("offline"); return new Promise(resolve => { finishRead = () => resolve(server); }); },
  async set(key, value) { writes.push({ uid: this.user.uid, key, value }); server = value; },
};
let stop;
try {
  globalThis.window = Object.assign(new EventTarget(), { jeojat: sdk, setInterval(callback) { timers.add(callback); return callback; }, clearInterval(callback) { timers.delete(callback); } });
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  const world = { getSavedPosition: () => state, restoreSavedPosition(value) { state = value; return true; } };
  const login = () => { for (const callback of events.get("login")) callback(); };
  const logout = () => { sdk.user = null; for (const callback of events.get("logout")) callback(); };
  stop = connectJeojatFarmer(world, user => names.push(user.nick)); await flush();
  assert.deepEqual(names, ["저잣거리 농부"]); assert.equal(writes.length, 0, "Never write the default spawn before reading the account save");
  finishRead(); await flush(); assert.equal(state, position(10, 100)); assert.equal(writes.length, 0);
  state = position(12, 200); for (const tick of timers) tick(); await flush();
  assert.equal(server, state, "Movement is saved per account without localStorage");
  for (const tick of timers) tick(); await flush(); assert.equal(writes.length, 1, "Unchanged positions are not uploaded again");
  state = position(13, 300); window.dispatchEvent(new Event("pagehide")); await flush(); assert.equal(server, state);

  logout(); state = position(14, 400); for (const tick of timers) tick(); await flush(); assert.equal(writes.length, 2, "Logout stops account saves");
  sdk.user = { uid: "account-a", nick: "저잣거리 농부" }; login(); await flush();
  finishRead(); await flush(); assert.equal(state, position(14, 400), "A newer local save wins over an older cloud save");
  assert.equal(server, state);

  logout(); sdk.user = { uid: "account-a", nick: "저잣거리 농부" }; server = position(20, 600); login(); await flush();
  state = position(15, 500); finishRead(); await flush();
  assert.equal(state, position(15, 500), "A delayed read cannot teleport a farmer who started moving");

  logout(); sdk.user = { uid: "account-b", nick: "다른 농부" }; server = position(-15, 50); login(); await flush();
  finishRead(); await flush();
  assert.equal(state, position(-15, 50), "Switching accounts restores that account even when the previous account had a newer local timestamp");
  logout(); sdk.user = { uid: "account-a", nick: "저잣거리 농부" }; login(); await flush();
  const staleRead = finishRead; logout(); server = position(99, 900); staleRead(); await flush();
  assert.equal(state, position(-15, 50), "A response from a logged-out account cannot overwrite the world");
  sdk.user = { uid: "account-b", nick: "다른 농부" }; failRead = true; login(); await flush();
  const count = writes.length; for (const tick of timers) tick(); await flush();
  assert.equal(writes.length, count, "Failed reads never overwrite an unknown remote position");
  stop(); assert.equal(timers.size, 0);
  console.log("Jeojat position validation passed: restore-before-write, iframe storage independence, timestamps, delayed-read movement, pagehide, logout/account isolation and read failures.");
} finally {
  stop?.();
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
}
