import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/navigation.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createNavigation } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

function checkRoute(navigation, from, destination) {
  const path = navigation.findPath(from, destination);
  assert.ok(path.length, "A reachable destination needs a route");
  let start = from;
  for (const end of path) {
    const steps = Math.ceil(Math.hypot(end.x - start.x, end.z - start.z) / .01);
    for (let step = 0; step <= steps; step++) {
      const fraction = steps ? step / steps : 0;
      assert.ok(navigation.isWalkable({ x: start.x + (end.x - start.x) * fraction, z: start.z + (end.z - start.z) * fraction }), "Every point on a route must avoid obstacles");
    }
    start = end;
  }
  return path;
}

const empty = createNavigation([]);
assert.deepEqual(checkRoute(empty, { x: 0, z: 9 }, { x: 5, z: 9 }), [{ x: 5, z: 9 }]);
assert.deepEqual(checkRoute(empty, { x: 0, z: 0 }, { x: 100, z: -100 }).at(-1), { x: 38.45, z: -33.45 });
assert.deepEqual(empty.findPath({ x: 0, z: 0 }, { x: NaN, z: 2 }), []);

const thinWall = createNavigation([{ x: 0, z: 0, w: .1, d: 8 }]);
const aroundWall = checkRoute(thinWall, { x: -3, z: 0 }, { x: 3, z: 0 });
assert.ok(aroundWall.length > 1);
assert.deepEqual(aroundWall.at(-1), { x: 3, z: 0 });
const besideWall = checkRoute(thinWall, { x: -3, z: 0 }, { x: 0, z: 0 }).at(-1);
assert.ok(Math.abs(besideWall.x) > .2 && Math.abs(besideWall.x) < .25);

const beds = createNavigation([-2.25, 0, 2.25].map((x) => ({ x, z: 0, w: 1.05, d: 12 })));
assert.deepEqual(checkRoute(beds, { x: -1.1, z: 5 }, { x: -1.1, z: -5 }).at(-1), { x: -1.1, z: -5 });
const betweenAisles = checkRoute(beds, { x: -1.1, z: 0 }, { x: 1.1, z: 0 });
assert.ok(betweenAisles.some((point) => Math.abs(point.z) > 6.15));

const closed = createNavigation([
  { x: -2, z: 0, w: .3, d: 4.3 }, { x: 2, z: 0, w: .3, d: 4.3 },
  { x: 0, z: -2, w: 4.3, d: .3 }, { x: 0, z: 2, w: 4.3, d: .3 },
]);
assert.deepEqual(closed.findPath({ x: -5, z: 0 }, { x: 0, z: 0 }), []);
console.log("Navigation validation passed: direct travel, bounds, invalid input, thin walls, blocked destinations, narrow aisles, unreachable areas.");
