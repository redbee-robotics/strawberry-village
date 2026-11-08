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
  const before = world.getPose();
  send(host.children[0], "pointerdown", { pointerType: "mouse", button: 0, pointerId: 1, clientX: 300, clientY: 300 });
  send(host.children[0], "pointermove", { pointerId: 1, clientX: 380, clientY: 320 });
  send(host.children[0], "pointerup", { pointerId: 1, button: 0, clientX: 380, clientY: 320 });
  tick();
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
  console.log("World action validation passed: visible character, anchored drag, drink animation, cancellation, one-time consumption, reduced motion, presence compatibility and disposal.");
} catch (error) {
  console.error(error.message); process.exitCode = 1;
} finally {
  world?.dispose(); THREE.TextureLoader.prototype.load = textureLoad;
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
}
