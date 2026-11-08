import assert from "node:assert/strict";
import fs from "node:fs";
import { createMockUserToken } from "@firebase/util";
const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error("Run this check through the local Firebase Database emulator.");
const namespace = "strawberry-village-default-rtdb";
const token = (uid) => createMockUserToken({ sub: uid, user_id: uid }, "strawberry-village");
async function request(path, method = "GET", body, identity = null) {
  const url = new URL(`http://${host}/${path}.json`); url.searchParams.set("ns", namespace);
  if (identity && identity !== "admin") url.searchParams.set("auth", token(identity));
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json", ...(identity === "admin" ? { Authorization: "Bearer owner" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const rules = JSON.parse(fs.readFileSync(new URL("../database.rules.json", import.meta.url), "utf8"));
assert.equal((await request(".settings/rules", "PUT", rules, "admin")).status, 200);
const player = (id, name) => ({ id, name, x: 0, z: 0, angle: 0, action: "walk", basket: 0, room: "outside", updatedAt: Date.now() });
assert.equal((await request("", "PUT", { village: { players: { alice: { "qa-alice": player("qa-alice", "아침 이슬") }, bob: { "qa-bob": player("qa-bob", "반가운 봄비") } } } }, "admin")).status, 200);
assert.ok((await request("village/speech")).status >= 400);
assert.equal((await request("village/speech", "GET", undefined, "alice")).status, 200);
const ownPath = "village/speech/alice/qa-alice";
assert.equal((await request(ownPath, "PUT", { text: "안녕하세요!", createdAt: Date.now() }, "alice")).status, 200);
assert.ok((await request(ownPath, "PUT", { text: "다른 사람 사칭", createdAt: Date.now() }, "bob")).status >= 400);
assert.ok((await request("village/speech/alice/missing", "PUT", { text: "접속 없는 세션", createdAt: Date.now() }, "alice")).status >= 400);
for (const invalid of [{ text: "", createdAt: Date.now() }, { text: "가".repeat(201), createdAt: Date.now() }, { text: "미래", createdAt: Date.now() + 60000 }, { text: "과거", createdAt: Date.now() - 120000 }, { text: "추가 필드", createdAt: Date.now(), extra: true }]) {
  await request(ownPath, "DELETE", undefined, "admin");
  assert.ok((await request(ownPath, "PUT", invalid, "alice")).status >= 400);
}
assert.equal((await request(ownPath, "PUT", { text: "이웃과 대화", createdAt: Date.now() }, "alice")).status, 200);
assert.ok((await request(ownPath, "DELETE", undefined, "bob")).status >= 400);
assert.equal((await request(ownPath, "DELETE", undefined, "alice")).status, 200);
assert.ok((await request("village/players/alice/qa-alice", "PUT", player("qa-alice", "다른 이름"), "bob")).status >= 400);
assert.equal((await request("village/players/alice/qa-alice", "PUT", player("qa-alice", "아침 이슬"), "alice")).status, 200);
console.log("Database rules passed against Firebase emulator: authenticated reads, own active-session speech, content and timestamp validation, foreign-write rejection, cleanup and existing presence ownership.");
