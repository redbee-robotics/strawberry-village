import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";

async function module(name) {
  const js = ts.transpileModule(fs.readFileSync(new URL(`../app/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}
const { watchJeojatUser, loginWithJeojat } = await module("jeojat");
const { rememberedNickname, rememberNickname } = await module("nicknames");
const globals = ["window", "localStorage", "sessionStorage"];
const previous = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const durable = new Map(), session = new Map(), users = [];
const storage = (data) => ({ getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) });
const key = "strawberry-farmer-name-v2";
let stop;
try {
  globalThis.window = new EventTarget();
  assert.throws(() => loginWithJeojat(), /not ready/, "A missing embed produces recoverable feedback instead of hiding the login entry");
  globalThis.localStorage = storage(durable); globalThis.sessionStorage = storage(session);
  session.set("strawberry-farmer-name-v1", "햇살 한 줌 7");
  assert.equal(rememberedNickname(), "햇살 한 줌");
  rememberNickname(rememberedNickname()); session.clear();
  assert.equal(rememberedNickname(), "햇살 한 줌", "Closing a tab does not clear the migrated nickname");
  durable.set(key, "가".repeat(17)); session.set(key, "남아 있는 이름");
  assert.equal(rememberedNickname(), "남아 있는 이름", "Invalid saved names do not mask a valid fallback");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("Storage denied"); } });
  rememberNickname("세션 이름"); assert.equal(rememberedNickname(), "세션 이름");

  let resolveReady;
  const events = new Map();
  const sdk = { site: "pYUoDazk7y", user: { uid: "visitor", nick: "저잣거리 이름" }, ready: new Promise(resolve => { resolveReady = resolve; }), on: (type, fn) => { if (!events.has(type)) events.set(type, []); events.get(type).push(fn); } };
  let loginCalled = false;
  sdk.login = () => { loginCalled = true; return Promise.resolve(sdk.user); };
  window.jeojat = sdk;
  const login = loginWithJeojat();
  assert.equal(loginCalled, true, "Login starts synchronously in the click handler, before SDK readiness, preserving popup activation");
  assert.deepEqual(await login, sdk.user);
  stop = watchJeojatUser(user => users.push(user));
  assert.equal(users.length, 0, "Wait for SDK readiness before using a cached account");
  resolveReady(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(users, [sdk.user], "An SDK loaded before the world is supported");
  for (const callback of events.get("login")) callback();
  assert.equal(users.length, 1, "Repeated ready/login signals do not overwrite a later app nickname");
  sdk.user = null; for (const callback of events.get("logout")) callback();
  assert.equal(users.length, 1, "Logout never replaces a name with a random guest nickname");
  sdk.user = { uid: "visitor", nick: "저잣거리 이름" }; for (const callback of events.get("login")) callback();
  assert.equal(users.length, 2, "Logging in again can restore the account nickname");
  sdk.user = { uid: "visitor", nick: "가".repeat(17) }; for (const callback of events.get("login")) callback();
  assert.equal(users.length, 2, "Malformed SDK names cannot break Firebase publication");
  stop(); sdk.user = { uid: "visitor", nick: "종료 뒤 이름" }; for (const callback of events.get("login")) callback();
  assert.equal(users.length, 2);
  window.jeojat = { ...sdk, site: "another-site" };
  assert.throws(() => loginWithJeojat(), /not ready/);
  stop = watchJeojatUser(user => users.push(user)); await Promise.resolve();
  assert.equal(users.length, 2, "Ignore an SDK configured for another site");
  console.log("Jeojat profile validation passed: SDK readiness, account events, duplicate events, disposal, site/name validation, nickname migration and denied-storage fallback.");
} finally {
  stop?.();
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
}
