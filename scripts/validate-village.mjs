import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
async function module(name) {
  const source = fs.readFileSync(new URL(`../app/${name}.ts`, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}
const { sessionNicknames, unusedNickname, cleanNickname } = await module("nicknames");
const players = [{ id: "old", name: "햇살 한 줌" }, { id: "v2-1", name: "햇살 한 줌" }, { id: "v2-2", name: "햇살 한 줌" }];
const names = sessionNicknames(players);
assert.equal(new Set(names.values()).size, 3);
assert.equal(names.get("old"), "햇살 한 줌");
assert.deepEqual([...sessionNicknames([...players].reverse())], [...names]);
assert.equal(cleanNickname("  초록  산책  "), "초록 산책");
assert.ok(unusedNickname("가".repeat(16), new Set(["가".repeat(16)])).length <= 16);
const { encodePosition, decodePosition } = await module("presence-pose");
const { MAP_BOUNDS, groundHeight, MOUNTAIN_TRAIL } = await module("terrain");
for (const x of [MAP_BOUNDS.minX, 0, MAP_BOUNDS.maxX]) for (const z of [MAP_BOUNDS.minZ, 0, MAP_BOUNDS.maxZ]) {
  const wire = encodePosition(x, z);
  assert.ok(Math.abs(wire.x) <= 39 && Math.abs(wire.z) <= 34);
  const decoded = decodePosition("v2-session", wire.x, wire.z);
  assert.ok(Math.abs(decoded.x - x) <= .011 && Math.abs(decoded.z - z) <= .016);
}
assert.deepEqual(decodePosition("legacy", 12, -18), { x: 12, z: -18 });
assert.equal(groundHeight(0, 0), 0);
assert.equal(groundHeight(0, -66), 22);
assert.equal(groundHeight(0, -34), 0);
assert.ok(groundHeight(0, -34.001) < .001);
let previous = 0;
for (const [x, z] of MOUNTAIN_TRAIL) { const height = groundHeight(x, z); assert.ok(height >= previous); previous = height; }
console.log("Village validation passed: nickname collisions, deterministic naming, normalized presence coordinates, terrain continuity and ascending trail.");
