import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
const source = fs.readFileSync(new URL("../app/first-person.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { readFirstPersonView, turnFirstPerson, zoomFirstPerson, firstPersonForward, firstPersonFrame } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const view = readFirstPersonView();
const position = { x: 21, y: 0, z: 3 };
const frame = firstPersonFrame(position, "stand", view, false);
assert.deepEqual(frame.eye, { x: 21, y: 1.55, z: 3 });
assert.ok(frame.target.z < frame.eye.z, "Start facing into the village");
const turned = turnFirstPerson(view, 80, -30);
assert.ok(firstPersonForward(turned).x > 0, "Dragging right turns the view right");
assert.ok(turned.pitch > view.pitch, "Dragging up raises the view");
for (const amount of [-1e6, 1e6]) {
 const extreme = turnFirstPerson(view, amount, amount);
 assert.ok(Math.abs(extreme.pitch) < Math.PI / 2, "Never flip the camera upside down");
 assert.ok(Math.abs(extreme.yaw) <= Math.PI, "Keep stored angles bounded");
}
for (const posture of ["stand", "sit", "lie"]) {
 const base = firstPersonFrame(position, posture, view, false);
 const moved = firstPersonFrame({ x: 23, y: 22, z: -66 }, posture, view, false);
 assert.equal(moved.eye.y - base.eye.y, 22, "Eye follows terrain and jumping without orbiting");
 assert.equal(moved.eye.x, 23); assert.equal(moved.eye.z, -66);
}
for (const factor of [0.01, 100]) {
 const zoomed = firstPersonFrame(position, "stand", zoomFirstPerson(view, factor), true);
 assert.deepEqual(zoomed.eye, frame.eye, "Zoom cannot move the camera through a wall");
 assert.ok(zoomed.fov >= 45 && zoomed.fov <= 95);
}
assert.deepEqual(readFirstPersonView({ camera: [62, 49, 67], target: [0, 0.9, 0] }), view, "Legacy orbit views do not override eye-level viewing");
assert.deepEqual(readFirstPersonView({ yaw: NaN, pitch: Infinity, zoom: -Infinity }), view);
assert.deepEqual(readFirstPersonView(turned), turned, "Restore the saved first-person direction");
console.log("First-person validation passed: eye height, look direction, pitch limits, terrain, posture, anchored zoom and saved-view migration.");
