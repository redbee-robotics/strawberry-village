import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";

async function module(name) {
  const js = ts.transpileModule(fs.readFileSync(new URL(`../app/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}
const { watchJeojatUser, loginWithJeojat, prepareJeojatFrameEntry } = await module("jeojat");
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
  stop();

  // Deterministic clock: a lost SDK hello gets one delayed retry, with no
  // automatic login dialog, token handling or repeated consent prompts.
  let now = 0, nextTimer = 0;
  const timers = new Map(), messages = [];
  window = new EventTarget();
  window.self = window;
  window.top = window.parent = { postMessage: (...args) => messages.push(args) };
  window.setTimeout = (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, at: now + delay }); return id; };
  window.clearTimeout = id => timers.delete(id);
  const advance = (ms) => { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); } };
  const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
  const frameSdk = (extra = {}) => {
    const listeners = new Map();
    return { site: "pYUoDazk7y", user: null, ready: Promise.resolve(),
      on: (event, fn) => { if (!listeners.has(event)) listeners.set(event, []); listeners.get(event).push(fn); },
      emit: event => { for (const fn of listeners.get(event) || []) fn(); },
      login: () => { throw new Error("Automatic frame entry must not request login"); }, ...extra };
  };
  stop = prepareJeojatFrameEntry();
  advance(10000); assert.equal(messages.length, 0, "Wait for an asynchronously loaded SDK");
  let frameReady;
  window.jeojat = frameSdk({ ready: new Promise(resolve => { frameReady = resolve; }) });
  window.dispatchEvent(new Event("jeojat:ready"));
  advance(10000); assert.equal(messages.length, 0, "Do not race the SDK's first attempt");
  frameReady(); await flush();
  advance(2999); assert.equal(messages.length, 0);
  advance(1);
  assert.deepEqual(messages, [[{ type: "jeojat:hello", site: "pYUoDazk7y" }, "https://jeojat.altolab.ai"]], "Retry only the greeting, addressed to the exact trusted parent origin");
  advance(60000); assert.equal(messages.length, 1, "Do not poll or repeatedly reopen consent");
  stop();

  for (const event of ["login", "logout"]) {
    window.jeojat = frameSdk(); stop = prepareJeojatFrameEntry(); await flush();
    window.jeojat.emit(event); advance(3000);
    assert.equal(messages.length, 1, `${event} cancels the pending automatic greeting`);
    stop();
  }
  window.jeojat = frameSdk(); stop = prepareJeojatFrameEntry(); await flush(); stop(); advance(3000);
  assert.equal(messages.length, 1, "Unmount cancels the pending greeting");
  stop = prepareJeojatFrameEntry(); await flush(); window.dispatchEvent(new Event("pagehide")); advance(3000);
  assert.equal(messages.length, 1, "Leaving the page cancels the greeting"); stop();
  window.jeojat = frameSdk({ login: () => Promise.resolve(null) });
  stop = prepareJeojatFrameEntry(); await flush(); await loginWithJeojat(); advance(3000);
  assert.equal(messages.length, 1, "An explicit login replaces the pending automatic retry"); stop();
  window.jeojat = frameSdk({ ready: Promise.reject(new Error("SDK failed")) });
  stop = prepareJeojatFrameEntry(); await flush(); advance(3000);
  assert.equal(messages.length, 1, "Failed SDK readiness does not trigger a greeting"); stop();
  window.jeojat = frameSdk({ site: "another-site" });
  stop = prepareJeojatFrameEntry(); await flush(); advance(3000);
  assert.equal(messages.length, 1, "Other SDK site IDs cannot initiate frame entry"); stop();

  window.jeojat = frameSdk({ user: { uid: "previous", nick: "이전 계정" }, ready: new Promise(resolve => { frameReady = resolve; }) });
  stop = prepareJeojatFrameEntry(); advance(10000);
  assert.equal(messages.length, 1, "Wait for cached-token validation before a parent response can replace the account");
  frameReady(); await flush();
  assert.equal(messages.length, 2, "A cached account still requests the current parent account");
  window.jeojat.user = { uid: "current", nick: "현재 계정" }; window.jeojat.emit("login"); advance(10000);
  assert.equal(messages.length, 2, "A confirmed parent login cancels the retry even when it restored the same account"); stop();
  window.jeojat = frameSdk({ user: { uid: "previous", nick: "이전 계정" } });
  stop = prepareJeojatFrameEntry(); await flush();
  assert.equal(messages.length, 3);
  advance(5499); assert.equal(messages.length, 3, "Allow a slow parent to finish loading even with immediately ready cached credentials");
  advance(1); assert.equal(messages.length, 4, "Retry the cached-account greeting once when the parent has not returned a login");
  advance(10000); assert.equal(messages.length, 4); stop();
  window.jeojat = frameSdk({ ready: new Promise(resolve => { frameReady = resolve; }) });
  stop = prepareJeojatFrameEntry(); window.jeojat.emit("logout"); frameReady(); await flush(); advance(3000);
  assert.equal(messages.length, 5, "Invalidating a cached token during SDK initialization must not cancel the hello retry"); stop();
  assert.ok(messages.every(([message, target]) => message.type === "jeojat:hello" && message.site === "pYUoDazk7y" && target === "https://jeojat.altolab.ai"), "Every account refresh stays within the trusted parent protocol");
  window.jeojat = frameSdk(); window.top = window;
  stop = prepareJeojatFrameEntry(); await flush(); advance(3000);
  assert.equal(messages.length, 5, "Standalone visits never trigger automatic entry"); stop();
  assert.equal(timers.size, 0);
  console.log("Jeojat profile validation passed: SDK readiness/events, cached-account refresh, invalid-token recovery, bounded iframe greeting retries, exact target origin, lifecycle/login cancellation, standalone behavior, nickname migration and denied-storage fallback.");
} finally {
  stop?.();
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
}
