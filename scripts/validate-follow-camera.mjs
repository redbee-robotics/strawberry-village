import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
const source = fs.readFileSync(new URL("../app/follow-camera.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { readFollowView, turnFollowView, zoomFollowView, followForward, followFrame, constrainFollowEye } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const view = readFollowView();
const position = { x: 21, y: 0, z: 3 };
const frame = followFrame(position, "stand", view, false);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
assert.deepEqual(frame.target, { x: 21, y: 1.1, z: 3 });
close(distance(frame.eye, frame.target), 7.5);
assert.ok(frame.eye.z > frame.target.z && frame.eye.y > frame.target.y, "See the character from behind and above");
const turned = turnFollowView(view, 80, -30);
assert.ok(followForward(turned).x > 0, "Dragging right turns the view right");
assert.ok(turned.pitch > view.pitch, "Dragging up raises the viewing direction");
for (const amount of [-1e6, -200, 200, 1e6]) {
  const rotated = turnFollowView(view, amount, amount);
  const orbit = followFrame(position, "stand", rotated, false);
  assert.deepEqual(orbit.target, frame.target, "Rotation never pans away from the character");
  close(distance(orbit.eye, orbit.target), 7.5);
  assert.ok(orbit.eye.y > orbit.target.y, "Cannot orbit beneath the character");
  assert.ok(Math.abs(rotated.yaw) <= Math.PI);
}
for (const posture of ["stand", "sit", "lie"]) {
  const base = followFrame(position, posture, view, false);
  const moved = followFrame({ x: 23, y: 22, z: -66 }, posture, view, false);
  for (const key of ["eye", "target"]) {
    close(moved[key].x - base[key].x, 2);
    close(moved[key].y - base[key].y, 22);
    close(moved[key].z - base[key].z, -69);
  }
}
for (const factor of [0.01, 100]) {
  const zoomed = followFrame(position, "stand", zoomFollowView(view, factor), true);
  assert.deepEqual(zoomed.target, frame.target, "Zoom keeps the character at the center");
  assert.ok(distance(zoomed.eye, zoomed.target) >= 3 - 1e-8);
  assert.ok(distance(zoomed.eye, zoomed.target) <= 18 + 1e-8, "Zoom remains bounded around the character");
  const room = followFrame(position, "stand", zoomFollowView(view, factor), true, true);
  assert.ok(distance(room.eye, room.target) <= 8 + 1e-8);
}
const wide = followFrame(position, "stand", zoomFollowView(view, 100), false);
close(distance(wide.eye, wide.target), 18);
assert.deepEqual(wide.target, frame.target, "The wider view stays anchored to the character");
for (const mobile of [false, true]) {
  const cafe = followFrame(position, "stand", readFollowView({ distance: 3, pitch: -1.05 }), mobile, "cafe");
  assert.ok(distance(cafe.eye, cafe.target) >= 6 - 1e-8, "Cafe starts with a wider framing even after a close saved view");
  assert.ok(cafe.fov >= 70, "The cafe has a wider field of view");
  assert.ok(cafe.eye.y < 7.3, "The larger cafe leaves room above the camera");
}
const origin = { x: 0, y: 1.1, z: 0 }, wanted = { x: 0, y: 3, z: 5 };
const sortingZoom = zoomFollowView(view, 100, "sorting");
close(sortingZoom.distance, 48);
const sortingTurn = turnFollowView(sortingZoom, 140, -20, "sorting");
close(sortingTurn.distance, 48);
assert.deepEqual(readFollowView(sortingTurn, "sorting"), sortingTurn, "Sorting zoom survives rotation and saved-view restoration");
for (const mobile of [false, true]) {
  const sorting = followFrame(position, "stand", sortingTurn, mobile, "sorting");
  close(distance(sorting.eye, sorting.target), 48);
  assert.deepEqual(sorting.target, frame.target, "Sorting zoom stays centered on the character");
  assert.ok(sorting.fov >= 68);
}
close(readFollowView(sortingTurn).distance, 18);
close(distance(followFrame(position, "stand", sortingTurn, false, true).eye, frame.target), 8);
const wall = { min: { x: -4, y: 0, z: 2 }, max: { x: 4, y: 4, z: 2.1 } };
const blocked = constrainFollowEye(origin, wanted, [wall]);
assert.ok(blocked.z < 1.82 && blocked.z > 1, "Camera stops before a wall with near-plane clearance");
const ceiling = { min: { x: -4, y: 2, z: -5 }, max: { x: 4, y: 2.1, z: 5 } };
assert.ok(constrainFollowEye(origin, wanted, [ceiling]).y < 1.82, "Camera stays below the ceiling");
assert.deepEqual(constrainFollowEye(origin, { ...wanted, z: -5 }, [wall]), { ...wanted, z: -5 }, "Unrelated walls do not shorten the orbit");
assert.ok(constrainFollowEye(origin, wanted, [], (_x, z) => z).z < 2, "Camera stops before rising ground");
assert.deepEqual(readFollowView({ yaw: NaN, pitch: Infinity, distance: -Infinity }), view);
assert.deepEqual(readFollowView(turned), turned);
console.log("Follow-camera validation passed: visible-character framing, fixed orbit center, movement, posture, bounded zoom, wall/ceiling/terrain clearance and saved view.");
