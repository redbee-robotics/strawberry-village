import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/presence-state.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { villagePresencePaths, activeVillagePlayers } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const villagePlayersPath = hostname => villagePresencePaths(hostname).players;

const production = villagePlayersPath("strawberry-village.web.app");
assert.equal(villagePlayersPath("strawberry-village.firebaseapp.com"), production);
const development = villagePlayersPath("localhost");
assert.notEqual(development, production);
assert.notEqual(villagePresencePaths("localhost").speech, villagePresencePaths("strawberry-village.web.app").speech);
for (const hostname of ["127.0.0.1", "::1", "192.168.1.20", "preview.example.com", "strawberry-village--preview.web.app", "strawberry-village.web.app.example.com"]) {
  assert.equal(villagePlayersPath(hostname), development, "Development and preview hosts must never enter production");
}

const now = 1800000000000;
const player = (id, updatedAt = now) => ({ id, name: "산들바람", x: 0, z: 9, angle: 0, action: "walk", basket: 0, room: "outside", updatedAt });
const database = {
  "village/players": { oldUser: { old: player("old") } },
  [production]: { realUser: { one: player("one"), two: player("two") } },
  [development]: { tester: { test: player("test") } },
};
assert.deepEqual(activeVillagePlayers(database[production], now).map(p => p.id), ["one", "two"]);
assert.deepEqual(activeVillagePlayers(database[development], now).map(p => p.id), ["test"]);
delete database[development];
assert.deepEqual(activeVillagePlayers(database[production], now).map(p => p.id), ["one", "two"], "Leaving development must not remove production visitors");

const sessions = { user: {
  recent: player("recent", now - 29999),
  expired: player("expired", now - 30000),
  old: player("old", now - 124000),
  missingTimestamp: player("missing", undefined),
  invalidTimestamp: player("invalid", NaN),
  future: player("future", now + 1001),
  serverEstimate: player("serverEstimate", now + 1000),
  invalidPosition: { ...player("invalidPosition"), x: Infinity },
} };
delete sessions.user.missingTimestamp.updatedAt;
assert.deepEqual(activeVillagePlayers(sessions, now).map(p => p.id), ["recent", "serverEstimate"]);
assert.deepEqual(activeVillagePlayers({ user: { current: player("current") } }, now + 30000), [], "Expired visitors must disappear without a database update");
assert.deepEqual(activeVillagePlayers({}, now), []);

console.log("Presence validation passed: production/development isolation, preview hosts, legacy exclusion, session counts, expiry and invalid timestamps/positions.");
