import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
import * as THREE from "three";

// Exercise the real world, geometry and action loop without requiring a GPU.
const dataUrl = (js) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
const cache = new Map([
  ["place-labels", dataUrl("export const createPlaceLabels = () => ({update(){},dispose(){}});")],
  ["visitor-labels", dataUrl("export const createVisitorLabels = () => ({add(){},remove(){},setName(){},setSpeech(){},update(){},dispose(){}});")],
]);
async function moduleUrl(name) {
  if (cache.has(name)) return cache.get(name);
  let js = ts.transpileModule(fs.readFileSync(new URL(`../app/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const match of [...js.matchAll(/from "\.\/(.*?)"/g)]) js = js.replaceAll(`from "./${match[1]}"`, `from "${await moduleUrl(match[1])}"`);
  if (name === "world") js = js.replace('import * as THREE from "three";', 'import * as OriginalTHREE from "three"; const THREE = {...OriginalTHREE, WebGLRenderer: globalThis.worldActionTestRenderer};');
  js = js.replaceAll('from "three"', `from "${import.meta.resolve("three")}"`);
  const url = dataUrl(js); cache.set(name, url); return url;
}
class Element extends EventTarget {
  style = {}; children = []; clientWidth = 1280; clientHeight = 800;
  setAttribute() {} focus() {} remove() {}
  appendChild(child) { this.children.push(child); }
  getContext() { return new Proxy({}, { get: () => () => {} }); }
  getBoundingClientRect() { return { left: 0, top: 0, right: 1280, bottom: 800, width: 1280, height: 800 }; }
  setPointerCapture() {} hasPointerCapture() { return false; }
}
let now = 100, frameCallback, renderedScene, renderedCamera;
const storage = new Map();
const globals = ["window", "document", "localStorage", "performance", "ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame", "worldActionTestRenderer"];
const previous = new Map(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const textureLoad = THREE.TextureLoader.prototype.load;
Object.assign(globalThis, {
  window: Object.assign(new EventTarget(), { devicePixelRatio: 1 }),
  document: Object.assign(new EventTarget(), { hidden: false, createElement: () => new Element() }),
  localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  performance: { now: () => now },
  ResizeObserver: class { observe() {} disconnect() {} },
  requestAnimationFrame: (callback) => { frameCallback = callback; return 1; },
  cancelAnimationFrame: () => {},
  worldActionTestRenderer: class {
    domElement = new Element(); shadowMap = {};
    setPixelRatio() {} setSize() {} dispose() {}
    render(scene, camera) { renderedScene = scene; renderedCamera = camera; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); }
  },
});
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
const tick = (ms = 16) => { now += ms; frameCallback(now); };
const send = (target, type, values) => target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), values));
let world;
try {
  const { createFarmWorld } = await import(await moduleUrl("world"));
  const host = new Element();
  world = createFarmWorld(host, () => {}, () => {}, () => {});
  tick();
  const farmer = renderedScene.children.find((object) => object.getObjectByName("farm-cup"));
  const cup = farmer.getObjectByName("farm-cup");
  assert.equal(farmer.visible, true, "The local character is visible in third person");
  const anchor = farmer.position.clone().add(new THREE.Vector3(0, 1.1, 0));
  assert.ok(renderedCamera.position.distanceTo(anchor) > 3);
  world.pose("lie"); tick();
  assert.equal(world.getPose().action, "lie", "Rest on ordinary ground without a lounger");
  assert.ok(farmer.getObjectByName("posture").position.y < 0.3, "Ground resting does not float at platform height");
  world.pose("lie"); tick(); assert.equal(world.getPose().action, "walk");
  const stationaryNeighbor = { ...world.getTestNeighbor() };
  const before = world.getPose();
  send(host.children[0], "pointerdown", { pointerType: "mouse", button: 0, pointerId: 1, clientX: 300, clientY: 300 });
  send(host.children[0], "pointermove", { pointerId: 1, clientX: 380, clientY: 320 });
  send(host.children[0], "pointerup", { pointerId: 1, button: 0, clientX: 380, clientY: 320 });
  tick();
  assert.deepEqual(world.getTestNeighbor(), stationaryNeighbor, "Turning the camera does not move the test neighbor");
  assert.deepEqual(world.getPose(), before, "Rotating the camera neither walks nor turns the character");
  const projected = anchor.clone().project(renderedCamera);
  assert.ok(Math.abs(projected.x) < 1e-6 && Math.abs(projected.y) < 1e-6, "Dragging keeps the character centered");
  assert.equal(await world.perform("drink"), "empty");
  world.setDrink(true); tick(); assert.equal(cup.visible, true);
  const interrupted = world.perform("drink"); tick(600);
  assert.ok(cup.parent.rotation.x < -1, "Drinking lifts the cup toward the mouth");
  assert.equal(world.getPose().action, "cafe", "Keep compatibility with deployed presence rules");
  send(host.children[0], "keydown", { key: "ArrowRight", code: "ArrowRight" });
  assert.equal(await interrupted, "cancelled");
  send(window, "keyup", { key: "ArrowRight" }); tick(); assert.equal(cup.visible, true, "Interrupted drinks remain available");
  const paused = world.perform("drink"); tick(400); world.setPaused(true);
  assert.equal(await paused, "cancelled"); world.setPaused(false); tick(); assert.equal(cup.visible, true);
  const duplicate = world.perform("drink"), completed = world.perform("drink");
  assert.equal(await duplicate, "cancelled"); tick(1801);
  assert.equal(await completed, "done"); assert.equal(cup.visible, false);
  assert.equal(await world.perform("drink"), "empty", "A finished drink cannot be consumed twice");
  world.setDrink(true); world.setReducedMotion(true);
  const reduced = world.perform("drink"); tick(400); assert.ok(cup.parent.rotation.x < -1); tick(1500);
  assert.equal(await reduced, "done");
  world.setDrink(true); const disposed = world.perform("drink"); world.dispose(); world = null;
  assert.equal(await disposed, "cancelled");
  assert.equal(JSON.parse(storage.get("strawberry-world-position-v2")).cameraMode, "follow");
  storage.set("strawberry-world-position-v2", JSON.stringify({ version: 2, x: 21, z: 0.5, angle: Math.PI, room: "cafe", posture: "stand", cameraMode: "follow", view: { yaw: Math.PI, pitch: -1.05, distance: 3 } }));
  world = createFarmWorld(new Element(), () => {}, () => {}, () => {}); tick();
  assert.equal(world.getPose().room, "cafe");
  assert.ok(renderedCamera.fov >= 70, "The actual cafe camera uses the wider field of view");
  const feet = new THREE.Vector3(21, 0, 0.5).project(renderedCamera), head = new THREE.Vector3(21, 2.1, 0.5).project(renderedCamera);
  assert.ok(Math.abs(head.y - feet.y) < 1, "The cafe entrance view does not fill the screen with the character");
  const tester = world.getTestNeighbor();
  assert.ok(tester && tester.room === "cafe", "A nearby test neighbor can stand inside the cafe");
  assert.ok(Math.hypot(tester.x - 21, tester.z - 0.5) <= 5);
  const beforeZoom = Math.abs(head.y - feet.y);
  world.zoom(100); tick();
  const wideFeet = new THREE.Vector3(21, 0, 0.5).project(renderedCamera), wideHead = new THREE.Vector3(21, 2.1, 0.5).project(renderedCamera);
  assert.ok(Math.abs(wideHead.y - wideFeet.y) < beforeZoom, "Zooming out inside the cafe makes the character smaller");
  world.dispose();
  storage.set("strawberry-world-position-v2", JSON.stringify({ version: 2, x: 21, z: 3.2, angle: Math.PI, room: "outside", posture: "stand", cameraMode: "follow", view: { yaw: Math.PI, pitch: -0.38, distance: 8 } }));
  const entranceHost = new Element();
  world = createFarmWorld(entranceHost, () => {}, () => {}, () => {}); tick();
  send(entranceHost.children[0], "keydown", { key: "ArrowUp", code: "ArrowUp" });
  for (let i = 0; i < 5; i++) tick(100);
  send(window, "keyup", { key: "ArrowUp" });
  assert.equal(world.getPose().room, "cafe", "Walking through the outside door enters the expanded room");
  assert.ok(world.getPose().z < 1, "Entry moves to the interior's open floor");
  send(entranceHost.children[0], "keydown", { key: "ArrowDown", code: "ArrowDown" });
  for (let i = 0; i < 25; i++) tick(100);
  send(window, "keyup", { key: "ArrowDown" });
  assert.equal(world.getPose().room, "outside", "The interior door returns to the exterior terrace");
  world.dispose();
  storage.set("strawberry-world-position-v2", JSON.stringify({ version: 2, x: 0, z: 19, angle: Math.PI, room: "sorting", posture: "stand", cameraMode: "follow", view: { yaw: Math.PI, pitch: -0.38, distance: 8 } }));
  let stationOpened = false;
  const sortingHost = new Element();
  world = createFarmWorld(sortingHost, () => {}, () => { stationOpened = true; }, () => {}); tick();
  assert.equal(world.getPose().room, "sorting"); assert.equal(stationOpened, false, "Entering sorting does not automatically open the work panel");
  const fixedNeighbor = { ...world.getTestNeighbor() };
  send(sortingHost.children[0], "keydown", { key: "ArrowLeft", code: "ArrowLeft" }); tick(100); send(window, "keyup", { key: "ArrowLeft" });
  assert.deepEqual(world.getTestNeighbor(), fixedNeighbor, "The test neighbor stays put when the player walks");
  world.pose("lie"); tick(); world.dispose();
  world = createFarmWorld(new Element(), () => {}, () => {}, () => {}); tick();
  assert.equal(world.getPose().action, "lie", "Ground resting survives reconnecting");
  console.log("World action validation passed: visible character, anchored drag, drink animation, cancellation, one-time consumption, reduced motion, presence compatibility and disposal.");
} catch (error) {
  console.error(error.message); process.exitCode = 1;
} finally {
  world?.dispose(); THREE.TextureLoader.prototype.load = textureLoad;
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
}
