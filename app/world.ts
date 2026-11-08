import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildVillage, HOUSE_CENTERS, type Station, type RoomId } from "./village";
import type { VillageWeather } from "./weather";
import { createNavigation, type GroundPoint } from "./navigation";
import { createPlaceLabels } from "./place-labels";
import { createVisitorLabels } from "./visitor-labels";
import { groundHeight, MAP_BOUNDS } from "./terrain";

export type FarmAction = "walk" | "water" | "harvest";
export type FarmPlace = "yard" | "greenhouse" | Station;
export type RemotePlayer = { id: string; name: string; x: number; z: number; angle: number; action: string; basket: number; room?: RoomId };
export type FarmAccess = { water: boolean; harvest: boolean; sit: boolean; lie: boolean; posture: "stand" | "sit" | "lie"; inspect: boolean; inspecting: boolean };
type Outcome = "done" | "empty" | "cancelled" | "far";
export type FarmWorld = {
  dispose: () => void;
  perform: (action: "water" | "harvest") => Promise<Outcome>;
  cancel: () => void;
  pose: (posture: "sit" | "lie") => void;
  setBasket: (count: number) => void;
  setBag: (count: number) => void;
  setDrink: (value: boolean) => void;
  setPaused: (value: boolean) => void;
  setName: (name: string) => void;
  getPose: () => { x: number; z: number; angle: number; action: string; basket: number; room: RoomId };
  setPlayers: (players: RemotePlayer[]) => void;
  setWeather: (weather: VillageWeather) => void;
  inspectBed: () => void;
  setReducedMotion: (value: boolean) => void;
  zoom: (factor: number) => void;
  resetCamera: () => void;
};
type Transform = { p: number[]; r?: number[]; s?: number[] };

// Geometry follows the photographed glasshouse: arched steel frames,
// elevated white hydroponic troughs, serrated leaves and five-petal flowers.
export function createFarmWorld(host: HTMLElement, onMessage: (text: string) => void, onStation: (station: Station) => void, onBedAccess: (access: FarmAccess) => void, onRoomChange: (room: RoomId) => void = () => {}): FarmWorld {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2("#e1e9d8", 0.0035);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute("aria-label", "3D 딸기 농장. 클릭하거나 터치한 곳으로 걷기. 방향키로도 걷기. 한 손가락 드래그로 화면 회전, 두 손가락 드래그로 화면 이동, 핀치로 확대와 축소. 마우스는 우클릭 드래그로 화면 이동, 휠로 확대와 축소.");
  renderer.domElement.setAttribute("role", "application");
  host.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 180);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.07;
  controls.enablePan = true; controls.screenSpacePanning = true; controls.panSpeed = .85; controls.zoomSpeed = .85;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }; controls.minDistance = 10; controls.maxDistance = 145;
  controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.42;
  controls.target.set(0, 0.9, 0);
  camera.position.set(62, 49, 67);
  const hemi = new THREE.HemisphereLight("#fcf8ec", "#708466", 2.1); scene.add(hemi);
  const sunlight = new THREE.DirectionalLight("#fff1d9", 3.0);
  sunlight.position.set(-34, 65, 24); sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, { left: -52, right: 52, top: 50, bottom: -50, far: 160, near: 1 });
  sunlight.shadow.normalBias = 0.045; sunlight.shadow.bias = -0.00015;
  sunlight.shadow.radius = 4; scene.add(sunlight);
  const fill = new THREE.DirectionalLight("#e6efda", 0.8); fill.position.set(10, 8, -18); scene.add(fill);

  let seed = 71;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const sphereGeo = new THREE.SphereGeometry(1, 12, 9);
  const up = new THREE.Vector3(0, 1, 0);
  const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
  const rodGeo = new THREE.CylinderGeometry(0.032, 0.032, 1, 7);
  const material = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.91, ...extra });
  const mat = {
    grass: material("#9eaf7c"), soil: material("#b0a080"), path: material("#d7c5a2"),
    white: material("#e8e8d6"), steel: material("#939c8b", { roughness: 0.5, metalness: 0.25 }),
    wood: material("#ad8760"), lightwood: material("#ccb18a"), darkwood: material("#6e6650"),
    leaf: material("#568448"), leafLight: material("#88a15d"), leafDark: material("#57784a"),
    flower: material("#fff9df"), pollen: material("#e6b94e"), berry: material("#c95644"),
    stone: material("#c1bfa5"), water: material("#a4bfac", { roughness: 0.25, metalness: 0.12 }),
    roof: material("#bb7457"), skin: material("#e4b895"), shirt: material("#f1e8cb"),
    overall: material("#627b59"), hair: material("#574b3a"), hat: material("#ddc48d"),
  };
  const worldRoot = new THREE.Group(); scene.add(worldRoot);
  const { obstacles, berries, beds, swaying, pondRipples, interactive, cutaways, seats, loungers, rooms, placeLabels, terrain } = buildVillage(worldRoot);
  const navigation = createNavigation(obstacles, MAP_BOUNDS);
  const buildingAreas = [
    ...HOUSE_CENTERS.map(([x, z], index) => ({ room: `house-${index}` as RoomId, x, z, w: 6.8, d: 12.7 })),
    { room: "cafe" as RoomId, x: 21, z: -.7, w: 8.4, d: 6.3 },
    { room: "sorting" as RoomId, x: 0, z: 19.7, w: 13, d: 7.8 },
  ];
  const labels = createPlaceLabels(host, camera, placeLabels, walkTo);
  const visitorLabels = createVisitorLabels(host, camera);
  const roomScenes: Record<string, THREE.Scene> = {};
  Object.keys(rooms).forEach((id) => {
    const roomScene = new THREE.Scene(); roomScene.background = new THREE.Color(id.startsWith("house") ? "#d8dfd1" : "#e5dfce");
    roomScene.add(new THREE.HemisphereLight("#fff9e9", "#929e83", 2.5));
    const isHouse = id.startsWith("house"), center = isHouse ? HOUSE_CENTERS[Number(id.slice(-1))] : id === "cafe" ? [21, -.7] : [0, 19.5];
    const light = new THREE.PointLight(isHouse ? "#fffde6" : "#ffe5b6", isHouse ? 24 : 35, 20, 2); light.position.set(center[0], isHouse ? 4 : 3.1, center[1]); roomScene.add(light);
    if (isHouse) {
      const film = material("#dce4d8", { transparent: true, opacity: .7, side: THREE.DoubleSide });
      for (const sign of [-1, 1]) { const panel = new THREE.Mesh(new THREE.PlaneGeometry(12.7, 2.3), film); panel.position.set(center[0] + sign * 3.4, 1.15, center[1]); panel.rotation.y = Math.PI / 2; roomScene.add(panel); }
    }
    roomScenes[id] = roomScene;
  });
  let activeRoom: RoomId = "outside", activeScene = scene;
  let outsideView: { position: THREE.Vector3; target: THREE.Vector3; fov: number } | null = null;
  let inspecting = false, inspectView: { position: THREE.Vector3; target: THREE.Vector3; min: number; max: number } | null = null;

  function mesh(geo: THREE.BufferGeometry, m: THREE.Material, p: number[], s = [1, 1, 1], parent: THREE.Object3D = scene) {
    const object = new THREE.Mesh(geo, m); object.position.set(p[0], p[1], p[2]); object.scale.set(s[0], s[1], s[2]);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  const box = (p: number[], s: number[], m = mat.wood, parent: THREE.Object3D = scene) => mesh(boxGeo, m, p, s, parent);
  const ball = (p: number[], s: number[], m: THREE.Material, parent: THREE.Object3D = scene) => mesh(sphereGeo, m, p, s, parent);
  const cylinder = (p: number[], s: number[], m: THREE.Material, parent: THREE.Object3D = scene) => mesh(cylinderGeo, m, p, s, parent);
  function beam(a: THREE.Vector3, b: THREE.Vector3, radius: number, m: THREE.Material, parent: THREE.Object3D = scene) {
    const mid = a.clone().add(b).multiplyScalar(0.5), direction = b.clone().sub(a);
    const object = mesh(cylinderGeo, m, mid.toArray(), [radius, direction.length(), radius], parent);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); return object;
  }
  function instances(geometry: THREE.BufferGeometry, m: THREE.Material, transforms: Transform[], parent: THREE.Object3D = scene) {
    const batch = new THREE.InstancedMesh(geometry, m, transforms.length), dummy = new THREE.Object3D();
    transforms.forEach((t, i) => { dummy.position.set(t.p[0], t.p[1], t.p[2]); dummy.rotation.set(...((t.r || [0, 0, 0]) as [number, number, number])); dummy.scale.set(...((t.s || [1, 1, 1]) as [number, number, number])); dummy.updateMatrix(); batch.setMatrixAt(i, dummy.matrix); });
    batch.castShadow = true; batch.receiveShadow = true; parent.add(batch); return batch;
  }
  // A small farmer made from rounded, tactile forms.
  const farmer = new THREE.Group(); farmer.position.set(0, 0, 9); farmer.scale.setScalar(1.15); farmer.rotation.y = 0.3; scene.add(farmer);
  const postureGroup = new THREE.Group(); postureGroup.name = "posture"; farmer.add(postureGroup);
  const body = new THREE.Group(); postureGroup.add(body);
  ball([0, 0.91, 0], [0.28, 0.35, 0.2], mat.shirt, body);
  ball([0, 0.68, 0.03], [0.255, 0.26, 0.2], mat.overall, body);
  box([0, 0.91, 0.184], [0.3, 0.33, 0.05], mat.overall, body);
  for (const x of [-0.12, 0.12]) box([x, 1.09, 0.14], [0.055, 0.28, 0.045], mat.overall, body);
  ball([0, 1.34, 0], [0.235, 0.26, 0.22], mat.skin, body);
  ball([0, 1.41, -0.07], [0.245, 0.20, 0.19], mat.hair, body);
  for (const x of [-0.08, 0.08]) ball([x, 1.34, 0.204], [0.018, 0.023, 0.011], mat.hair, body);
  ball([0, 1.285, 0.22], [0.035, 0.022, 0.025], mat.skin, body);
  cylinder([0, 1.56, 0], [0.49, 0.055, 0.49], mat.hat, body);
  mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.24, 24), mat.hat, [0, 1.69, 0], [1, 1, 1], body);
  cylinder([0, 1.602, 0], [0.327, 0.06, 0.327], mat.roof, body);
  const legs: THREE.Group[] = [], arms: THREE.Group[] = [];
  for (const sign of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(sign * 0.135, 0.6, 0); postureGroup.add(leg); leg.name = sign < 0 ? "leg-left" : "leg-right";
    cylinder([0, -0.16, 0], [0.105, 0.35, 0.105], mat.overall, leg); ball([0, -0.40, 0.06], [0.115, 0.12, 0.17], mat.darkwood, leg); legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(sign * 0.26, 1.09, 0); body.add(arm);
    arm.rotation.z = sign * 0.16; ball([sign * 0.035, -0.15, 0], [0.105, 0.23, 0.11], mat.shirt, arm); ball([sign * 0.055, -0.34, 0.015], [0.075, 0.09, 0.075], mat.skin, arm); arms.push(arm);
  }
  const can = new THREE.Group(); can.name = "water-can"; can.position.set(0.14, -0.35, 0.1); arms[1].add(can); can.visible = false;
  const canMat = material("#8da9a0", { roughness: 0.55, metalness: 0.15 });
  cylinder([0, -0.07, 0], [0.18, 0.28, 0.18], canMat, can);
  beam(new THREE.Vector3(0.1, -0.05, 0), new THREE.Vector3(0.42, 0.1, 0), 0.045, canMat, can);
  const handle = mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 16), canMat, [-0.14, -0.04, 0], [1, 1, 1], can); handle.rotation.y = Math.PI / 2;
  visitorLabels.add(farmer, "느긋한 농부");

  const basket = new THREE.Group(); basket.name = "harvest-basket"; basket.position.set(-.13, -.43, .13); arms[0].add(basket);
  const basketMaterial = material("#788764");
  box([0, -.09, 0], [.45, .25, .35], basketMaterial, basket);
  box([0, .045, 0], [.41, .035, .31], mat.darkwood, basket);
  const basketHandle = mesh(new THREE.TorusGeometry(.22, .022, 6, 16, Math.PI), mat.wood, [0, .03, 0], [1, 1, 1], basket); basketHandle.rotation.y = Math.PI / 2;
  const basketFruits: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) basketFruits.push(ball([((i % 3) - 1) * .12, .065, (Math.floor(i / 3) - .5) * .13], [.07, .09, .07], mat.berry, basket));
  basket.visible = false;
  const cup = new THREE.Group(); cup.name = "farm-cup"; cup.position.set(.05, -.31, .15); arms[1].add(cup); cup.visible = false;
  cylinder([0, .02, 0], [.1, .27, .1], material("#e3aa9b"), cup); cylinder([0, .17, 0], [.11, .025, .11], mat.shirt, cup);
  const straw = cylinder([.02, .28, 0], [.012, .2, .012], mat.overall, cup); straw.rotation.z = -.15;
  const backpack = new THREE.Group(); backpack.name = "farm-backpack"; backpack.position.set(0, .86, -.23); body.add(backpack);
  box([0, 0, -.06], [.42, .46, .2], material("#a38e68"), backpack); box([0, .18, -.09], [.44, .13, .23], mat.hat, backpack);
  const packed = box([0, .30, -.06], [.33, .18, .16], mat.white, backpack); packed.visible = false;
  function person(name: string, color: string) {
    const object = farmer.clone(true), clothes = material(color);
    object.children.filter((c) => c instanceof THREE.Sprite).forEach((c) => object.remove(c));
    object.traverse((child) => { const part = child as THREE.Mesh; if (part.material === mat.overall) part.material = clothes; if (["harvest-basket", "water-can", "farm-cup", "farm-backpack"].includes(child.name)) child.visible = false; });
    object.scale.setScalar(1.12); scene.add(object); visitorLabels.add(object, name);
    return { object, clothes };
  }
  // The counter attendant is the only fictional person. Visitors are live sessions.
  const clerk = person("카페 점원", "#907557"); clerk.object.position.set(21, 0, -2.55); clerk.object.rotation.y = 0;
  const remotePeople = new Map<string, ReturnType<typeof person> & { target: THREE.Vector3; angle: number; action: string; name: string; room: RoomId }>();
  let basketCount = 0, drinkHeld = false, paused = false, zoneLatched: Station | null = null;
  const dustGeo = new THREE.BufferGeometry(), dust = new Float32Array(65 * 3);
  for (let i = 0; i < 65; i++) { dust[i * 3] = (rand() - 0.5) * 34; dust[i * 3 + 1] = 0.8 + rand() * 5; dust[i * 3 + 2] = (rand() - 0.5) * 28; }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dust, 3));
  const dustPoints = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: "#fff5ca", size: 0.055, transparent: true, opacity: 0.7, depthWrite: false })); scene.add(dustPoints);
  const waterGeo = new THREE.BufferGeometry(), waterPositions = new Float32Array(90 * 3); waterGeo.setAttribute("position", new THREE.BufferAttribute(waterPositions, 3));
  const spray = new THREE.Points(waterGeo, new THREE.PointsMaterial({ color: "#d2edf0", size: 0.055, transparent: true, opacity: 0.9 })); scene.add(spray); spray.visible = false;
  const marker = mesh(new THREE.RingGeometry(0.25, 0.29, 40), new THREE.MeshBasicMaterial({ color: "#fff1cf", side: THREE.DoubleSide, transparent: true, opacity: 0.85 }), [2, 0.08, 7.3]); marker.rotation.x = -Math.PI / 2; marker.castShadow = false; marker.visible = false;

  let windStrength = .016, windSpeed = 0, snowing = false;
  const precipitationPositions = new Float32Array(600 * 6), dropSeeds = Array.from({ length: 600 }, () => ({ x: (rand() - .5) * 95, z: (rand() - .5) * 80, y: rand() * 22 }));
  const precipitationGeometry = new THREE.BufferGeometry(); precipitationGeometry.setAttribute("position", new THREE.BufferAttribute(precipitationPositions, 3).setUsage(THREE.DynamicDrawUsage));
  const rain = new THREE.LineSegments(precipitationGeometry, new THREE.LineBasicMaterial({ color: "#d4e7eb", transparent: true, opacity: .5 })); rain.visible = false; scene.add(rain);
  const snow = new THREE.Points(precipitationGeometry, new THREE.PointsMaterial({ color: "#f2f6ed", size: .11, transparent: true, opacity: .85 })); snow.visible = false; scene.add(snow);
  let reducedMotion = false, animationFrame = 0, previousTime = performance.now(), disposed = false;
  let cameraTransition: { position: THREE.Vector3; target: THREE.Vector3 } | null = null;
  let currentAction: { type: "water" | "harvest"; resolve: (value: Outcome) => void; berry?: typeof berries[number]; phase: "walking" | "acting"; time: number } | null = null;
  let markerTime = 0;
  let walkPath: GroundPoint[] = [];
  let jumpHeight = 0, jumpSpeed = 0;
  let tap: { id: number; x: number; y: number; moved: boolean } | null = null;
  const pointers = new Set<number>();
  const raycaster = new THREE.Raycaster(), groundPlane = new THREE.Plane(up, 0);
  const pressed = new Set<string>();
  let lastBedAccess: FarmAccess = { water: false, harvest: false, sit: false, lie: false, posture: "stand", inspect: false, inspecting: false };
  let posture: "stand" | "sit" | "lie" = "stand";
  let poseExit: THREE.Vector3 | null = null;
  const nearestSeat = () => seats.find((seat) => Math.hypot(seat.x - farmer.position.x, seat.z - farmer.position.z) < 1.6);
  const nearestLounger = () => loungers.find((space) => Math.hypot(space.x - farmer.position.x, space.z - farmer.position.z) < 3.0);
  function standUp() { posture = "stand"; postureGroup.rotation.x = 0; postureGroup.position.set(0, 0, 0); if (poseExit) { farmer.position.copy(poseExit); poseExit = null; } }
  const nearBed = () => beds.some((bed) => Math.hypot(Math.max(0, Math.abs(farmer.position.x - bed.x) - bed.w / 2), Math.max(0, Math.abs(farmer.position.z - bed.z) - bed.d / 2)) < 1.15);
  const nearRipe = () => berries.some((berry) => berry.ready && Math.hypot(berry.x - farmer.position.x, berry.z - farmer.position.z) < 1.8);
  function valid(x: number, z: number) {
    return navigation.isWalkable({ x, z });
  }
  function stopWalking() { walkPath = []; marker.visible = false; }
  function cancel() { stopWalking(); currentAction?.resolve("cancelled"); currentAction = null; spray.visible = false; can.visible = false; }
  function transition(position: THREE.Vector3, target: THREE.Vector3) {
    if (reducedMotion) { camera.position.copy(position); controls.target.copy(target); controls.update(); }
    else cameraTransition = { position, target };
  }
  function resetCamera() { if (inspecting) stopInspecting(); if (activeRoom !== "outside") { roomCamera(activeRoom); controls.update(); } else transition(new THREE.Vector3(62, 49, 67), new THREE.Vector3(0, 0.9, 0)); }
  const onControlStart = () => { cameraTransition = null; };
  controls.addEventListener("start", onControlStart);
  function stopInspecting() {
    inspecting = false;
    if (inspectView) { camera.position.copy(inspectView.position); controls.target.copy(inspectView.target); controls.minDistance = inspectView.min; controls.maxDistance = inspectView.max; controls.update(); inspectView = null; }
  }
  function viewAngle(room: RoomId) {
    const mobile = host.clientWidth < 640;
    return room === "cafe" ? (mobile ? 90 : 82) : room === "sorting" ? (mobile ? 80 : 72) : room.startsWith("house") ? (mobile ? 86 : 78) : mobile ? 64 : 40;
  }
  function roomCamera(room: RoomId) {
    camera.fov = viewAngle(room); camera.updateProjectionMatrix();
    if (room === "cafe") { camera.position.set(17.3, 3.05, 2.15); controls.target.set(21.3, 1, -1); }
    else if (room === "sorting") { camera.position.set(-5.1, 3.05, 22.4); controls.target.set(0, 1.15, 19.2); }
    else { const [x, z] = HOUSE_CENTERS[Number(room.slice(-1))]; camera.position.set(x + 1.2, 6.8, z + 12.8); controls.target.set(x + 1.1, 1.1, z - 1.7); }
  }
  function setRoom(next: RoomId) {
    if (next === activeRoom) return;
    stopInspecting(); cameraTransition = null;
    if (activeRoom !== "outside") { worldRoot.add(rooms[activeRoom]); const sign = rooms[activeRoom].getObjectByName("house-front-sign"); if (sign) sign.visible = true; }
    if (activeRoom === "outside") outsideView = { position: camera.position.clone(), target: controls.target.clone(), fov: camera.fov };
    activeRoom = next; activeScene = next === "outside" ? scene : roomScenes[next]; activeScene.add(farmer);
    if (next === "outside") {
      controls.minDistance = 10; controls.maxDistance = 145; controls.maxPolarAngle = 1.42;
      if (outsideView) { camera.position.copy(outsideView.position); controls.target.copy(outsideView.target); camera.fov = outsideView.fov; camera.updateProjectionMatrix(); outsideView = null; }
    } else { activeScene.add(rooms[next]); const sign = rooms[next].getObjectByName("house-front-sign"); if (sign) sign.visible = false; controls.minDistance = .6; controls.maxDistance = next.startsWith("house") ? 24 : 10; controls.maxPolarAngle = 1.7; roomCamera(next); }
    (next === "cafe" ? activeScene : scene).add(clerk.object);
    remotePeople.forEach((remote) => { (remote.room === next ? activeScene : scene).add(remote.object); remote.object.visible = remote.room === next; });
    controls.update(); onRoomChange(next);
  }
  function pointerDown(event: PointerEvent) {
    pointers.add(event.pointerId);
    if (!paused) renderer.domElement.focus({ preventScroll: true });
    if (pointers.size !== 1 || event.button !== 0 || !event.isPrimary || paused) { tap = null; return; }
    tap = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  }
  function pointerMove(event: PointerEvent) {
    if (tap?.id === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8) tap.moved = true;
  }
  function pointerUp(event: PointerEvent) {
    const click = tap;
    pointers.delete(event.pointerId); tap = null;
    if (!click || click.id !== event.pointerId || click.moved || paused || event.button !== 0
      || Math.hypot(event.clientX - click.x, event.clientY - click.y) > 8) return;
    const rect = renderer.domElement.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    const destination = (activeRoom === "outside" ? raycaster.intersectObject(terrain)[0]?.point : null) || raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
    if (!destination) return;
    walkTo(destination);
  }
  function walkTo(destination: GroundPoint) {
    if (paused) return;
    renderer.domElement.focus({ preventScroll: true });
    cancel(); pressed.clear(); if (inspecting) stopInspecting(); if (posture !== "stand") standUp();
    const targetRoom = buildingAreas.find((area) => Math.abs(destination.x - area.x) < area.w / 2 && Math.abs(destination.z - area.z) < area.d / 2)?.room;
    const blockedRooms = buildingAreas.filter((area) => area.room !== activeRoom && area.room !== targetRoom);
    walkPath = createNavigation([...obstacles, ...blockedRooms], MAP_BOUNDS).findPath(farmer.position, destination);
    const goal = walkPath.at(-1);
    if (goal) {
      marker.position.set(goal.x, (activeRoom === "outside" ? groundHeight(goal.x, goal.z) : 0) + .08, goal.z); activeScene.add(marker);
      marker.scale.setScalar(1); (marker.material as THREE.MeshBasicMaterial).opacity = .85;
      markerTime = performance.now(); marker.visible = true;
    }
  }
  function keyDown(e: KeyboardEvent) {
    if (e.code === "Space" && !paused) {
      e.preventDefault();
      if (!e.repeat && jumpHeight === 0) { cancel(); if (inspecting) stopInspecting(); if (posture !== "stand") standUp(); jumpSpeed = 6; }
      return;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      if (paused) return;
      e.preventDefault(); cancel(); if (inspecting) stopInspecting(); if (posture !== "stand") standUp(); pressed.add(e.key.toLowerCase());
    }
  }
  const keyUp = (e: KeyboardEvent) => pressed.delete(e.key.toLowerCase());
  const clearKeys = () => { pressed.clear(); stopWalking(); tap = null; pointers.clear(); };
  const positionKey = "strawberry-world-position-v2";
  let lastPositionSave = 0, lastPositionJson = "";
  function savePosition() {
    const point = poseExit || farmer.position;
    const value = JSON.stringify({ version: 2, x: point.x, z: point.z, angle: farmer.rotation.y, room: activeRoom, posture, camera: camera.position.toArray(), target: controls.target.toArray() });
    if (value === lastPositionJson) return;
    try { localStorage.setItem(positionKey, value); lastPositionJson = value; } catch { /* Storage can be unavailable. */ }
  }
  function restorePosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(positionKey) || "null");
      if (!saved || saved.version !== 2 || ![saved.x, saved.z, saved.angle].every(Number.isFinite)) return;
      if (saved.x <= MAP_BOUNDS.minX || saved.x >= MAP_BOUNDS.maxX || saved.z <= MAP_BOUNDS.minZ || saved.z >= MAP_BOUNDS.maxZ) return;
      const point = navigation.isWalkable(saved) ? saved : navigation.findPath({ x: 0, z: 9 }, saved).at(-1);
      if (!point) return;
      farmer.position.set(point.x, groundHeight(point.x, point.z), point.z); farmer.rotation.y = saved.angle;
      const area = buildingAreas.find((building) => Math.abs(point.x - building.x) < building.w / 2 && Math.abs(point.z - building.z) < building.d / 2);
      setRoom(area?.room || "outside");
      const validView = (value: unknown): value is number[] => Array.isArray(value) && value.length === 3 && value.every((coordinate) => Number.isFinite(coordinate) && Math.abs(coordinate) < 500);
      if (validView(saved.camera) && validView(saved.target)) { camera.position.fromArray(saved.camera); controls.target.fromArray(saved.target); controls.update(); }
      if (saved.posture === "sit" || saved.posture === "lie") {
        const spot = saved.posture === "sit" ? nearestSeat() : nearestLounger();
        if (spot) { poseExit = farmer.position.clone(); farmer.position.set(spot.x, 0, spot.z); farmer.rotation.y = spot.angle; posture = saved.posture; }
      }
    } catch { /* A corrupt saved position falls back to the yard. */ }
  }
  const saveOnHide = () => { if (document.hidden) savePosition(); };
  renderer.domElement.addEventListener("pointerdown", pointerDown);
  renderer.domElement.addEventListener("pointermove", pointerMove);
  renderer.domElement.addEventListener("pointerup", pointerUp);
  renderer.domElement.addEventListener("pointercancel", clearKeys);
  renderer.domElement.addEventListener("keydown", keyDown);
  renderer.domElement.addEventListener("blur", clearKeys);
  window.addEventListener("keyup", keyUp); window.addEventListener("blur", clearKeys);
  window.addEventListener("pagehide", savePosition); document.addEventListener("visibilitychange", saveOnHide);
  renderer.domElement.style.cursor = "pointer";
  function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.fov = viewAngle(activeRoom); camera.updateProjectionMatrix(); }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); resize(); restorePosition();
  function tick(now: number) {
    if (disposed) return;
    const dt = Math.min((now - previousTime) / 1000, 0.12); previousTime = now; const t = now / 1000;
    if (cameraTransition) {
      const rate = 1 - Math.pow(0.03, dt); camera.position.lerp(cameraTransition.position, rate); controls.target.lerp(cameraTransition.target, rate);
      if (camera.position.distanceTo(cameraTransition.position) < 0.03) cameraTransition = null;
    }
    let moving = false;
    const keyboard = new THREE.Vector3();
    if (!paused && pressed.size) {
      const forward = controls.target.clone().sub(camera.position); forward.y = 0; forward.normalize(); const right = new THREE.Vector3().crossVectors(forward, up).normalize();
      if (pressed.has("arrowup")) keyboard.add(forward);
      if (pressed.has("arrowdown")) keyboard.sub(forward);
      if (pressed.has("arrowright")) keyboard.add(right);
      if (pressed.has("arrowleft")) keyboard.sub(right);
      if (keyboard.lengthSq()) { keyboard.normalize().multiplyScalar(dt * 5.3); const next = farmer.position.clone().add(keyboard); if (valid(next.x, farmer.position.z)) farmer.position.x = next.x; if (valid(farmer.position.x, next.z)) farmer.position.z = next.z; farmer.rotation.y = Math.atan2(keyboard.x, keyboard.z); moving = true; }
    } else if (!paused && walkPath.length) {
      let remaining = dt * 5.3;
      while (walkPath.length && remaining > 0) {
        const next = walkPath[0], dx = next.x - farmer.position.x, dz = next.z - farmer.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < .001) { walkPath.shift(); continue; }
        const step = Math.min(remaining, distance), x = farmer.position.x + dx / distance * step, z = farmer.position.z + dz / distance * step;
        if (!valid(x, z)) { stopWalking(); break; }
        farmer.position.set(x, 0, z); farmer.rotation.y = Math.atan2(dx, dz); moving = true;
        remaining -= step; if (step === distance) walkPath.shift();
      }
    }
    if (!paused) {
      jumpSpeed -= 18 * dt; jumpHeight = Math.max(0, jumpHeight + jumpSpeed * dt); if (!jumpHeight) jumpSpeed = 0;
    }
    farmer.position.y = (activeRoom === "outside" ? groundHeight(farmer.position.x, farmer.position.z) : 0) + jumpHeight;
    if (activeRoom === "outside" && moving && (Math.abs(farmer.position.x) > 32 || farmer.position.z < -30 || farmer.position.z > 32)) {
      const shift = farmer.position.clone().add(new THREE.Vector3(0, 1, 0)).sub(controls.target).multiplyScalar(Math.min(1, dt * 2));
      camera.position.add(shift); controls.target.add(shift);
    }
    const swing = moving ? Math.sin(t * 12) * 0.48 : 0;
    legs[0].rotation.x = swing; legs[1].rotation.x = -swing; arms[0].rotation.x = -swing * 0.65; arms[1].rotation.x = swing * 0.65;
    body.position.y = moving && !reducedMotion ? Math.abs(Math.sin(t * 12)) * 0.055 : 0;
    if (posture === "sit") { legs[0].rotation.x = legs[1].rotation.x = -1.3; body.position.y = -.08; }
    if (posture === "lie") { postureGroup.rotation.x = -Math.PI / 2; postureGroup.position.set(0, .85, .8); }
    if (!paused && currentAction) {
      if (currentAction.phase === "walking") {
        currentAction.phase = "acting"; currentAction.time = now;
        const b = currentAction.berry;
        if (b) farmer.rotation.y = Math.atan2(b.x - farmer.position.x, b.z - farmer.position.z);
      }
      const elapsed = now - currentAction.time;
      if (currentAction.type === "water") {
        arms[1].rotation.x = -0.9; arms[1].rotation.z = -0.35; can.visible = true; spray.visible = true;
        const from = new THREE.Vector3(0.55, 1.05, 0.3).applyAxisAngle(up, farmer.rotation.y).add(farmer.position);
        const toward = new THREE.Vector3(currentAction.berry?.x ?? 0.55, 1.6, currentAction.berry?.z ?? -1.5);
        for (let i = 0; i < 90; i++) {
          const f = ((t * 1.2 + i / 90) % 1), p = from.clone().lerp(toward, f); p.y += Math.sin(f * Math.PI) * 0.25 - f * f * 0.25;
          waterPositions[i * 3] = p.x + Math.sin(i * 12.7) * f * 0.15; waterPositions[i * 3 + 1] = p.y; waterPositions[i * 3 + 2] = p.z + Math.cos(i * 8.1) * f * 0.15;
        }
        waterGeo.attributes.position.needsUpdate = true;
      } else { arms[0].rotation.x = -1.0; arms[1].rotation.x = -0.8; }
      if (elapsed > (currentAction.type === "water" ? 2100 : 1150)) {
        if (currentAction.type === "harvest" && currentAction.berry) { currentAction.berry.ready = false; currentAction.berry.mesh.visible = false; }
        if (currentAction.type === "water") berries.forEach((b) => { if (!b.ready && !b.growAt) b.growAt = now + 6000; });
        currentAction.resolve("done"); currentAction = null; spray.visible = false; can.visible = false; arms[1].rotation.z = 0.16;
      }
    }
    if (activeRoom === "outside") {
      if (Math.abs(farmer.position.x - 21) < 3.8 && farmer.position.z > -3.35 && farmer.position.z < 2.2) setRoom("cafe");
      else if (Math.abs(farmer.position.x) < 5.7 && farmer.position.z > 16.7 && farmer.position.z < 22.8) setRoom("sorting");
      else { const house = HOUSE_CENTERS.findIndex(([x, z]) => Math.abs(farmer.position.x - x) < 3.25 && Math.abs(farmer.position.z - z) < 6.2); if (house >= 0) setRoom(`house-${house}` as RoomId); }
    } else if (activeRoom === "cafe") {
      if (farmer.position.z > 3.0 || Math.abs(farmer.position.x - 21) > 4.5 || farmer.position.z < -4) setRoom("outside");
    } else if (activeRoom === "sorting") {
      if (farmer.position.z < 15.9 || farmer.position.z > 23.7 || Math.abs(farmer.position.x) > 6.7) setRoom("outside");
    } else { const [x, z] = HOUSE_CENTERS[Number(activeRoom.slice(-1))]; if (Math.abs(farmer.position.x - x) > 3.9 || Math.abs(farmer.position.z - z) > 7.0) setRoom("outside"); }
    const access: FarmAccess = { water: posture === "stand" && nearBed(), harvest: posture === "stand" && nearBed() && nearRipe(), sit: posture === "sit" || (posture === "stand" && !!nearestSeat()), lie: posture === "lie" || (posture === "stand" && !!nearestLounger()), posture, inspect: posture === "stand" && nearBed(), inspecting };
    if (Object.keys(access).some((key) => access[key as keyof FarmAccess] !== lastBedAccess[key as keyof FarmAccess])) { lastBedAccess = access; onBedAccess(access); }
    const zone: Station | null = Math.abs(farmer.position.x) < 5.6 && farmer.position.z > 17 && farmer.position.z < 22.95 ? "sorting" : Math.abs(farmer.position.x - 21) < 3.4 && farmer.position.z > -.5 && farmer.position.z < .7 ? "cafe" : null;
    if (!zone) zoneLatched = null;
    if (!paused && !currentAction && zone && zone !== zoneLatched) { zoneLatched = zone; pressed.clear(); stopWalking(); onStation(zone); }
    basket.visible = basketCount > 0; basketFruits.forEach((fruit, i) => fruit.visible = i < Math.min(basketCount, 6)); cup.visible = drinkHeld && currentAction?.type !== "water";
    berries.forEach((b) => { if (b.growAt && now > b.growAt) { b.ready = true; b.mesh.visible = true; b.growAt = 0; } });
    if (marker.visible) { const a = (now - markerTime) / 1000; marker.scale.setScalar(1 + a * 0.2); (marker.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - a * 0.35); if (a > 2.2) marker.visible = false; }
    remotePeople.forEach((remote) => {
      const moving = remote.object.position.distanceTo(remote.target) > .08;
      remote.object.position.lerp(remote.target, Math.min(1, dt * 5));
      remote.object.position.y = remote.room === "outside" ? groundHeight(remote.object.position.x, remote.object.position.z) : 0;
      remote.object.rotation.y += Math.atan2(Math.sin(remote.angle - remote.object.rotation.y), Math.cos(remote.angle - remote.object.rotation.y)) * Math.min(1, dt * 8);
      const step = moving && !reducedMotion ? Math.sin(t * 11) * .4 : 0;
      const leftLeg = remote.object.getObjectByName("leg-left"), rightLeg = remote.object.getObjectByName("leg-right"), pose = remote.object.getObjectByName("posture");
      if (leftLeg) leftLeg.rotation.x = remote.action === "sit" ? -1.3 : step;
      if (rightLeg) rightLeg.rotation.x = remote.action === "sit" ? -1.3 : -step;
      if (pose) { pose.rotation.x = remote.action === "lie" ? -Math.PI / 2 : 0; pose.position.set(0, remote.action === "lie" ? .85 : 0, remote.action === "lie" ? .8 : 0); }
    });
    if (!reducedMotion) {
      swaying.forEach((s) => s.mesh.rotation.z = s.origin + Math.sin(t * 0.65 + s.phase) * windStrength);
      dustPoints.rotation.y = Math.sin(t * 0.035) * 0.07;
      pondRipples.forEach((r, i) => { const a = 1 + Math.sin(t * 0.8 + i) * 0.07; r.scale.set(a, a * 0.7, 1); });
    }
    if (!reducedMotion && (rain.visible || snow.visible)) {
      dropSeeds.forEach((drop, i) => {
        const y = 22 - ((t * (snowing ? 1.4 : 11) + drop.y) % 22), x = drop.x + (snowing ? Math.sin(t + i) * .35 : 0);
        precipitationPositions[i * 6] = x; precipitationPositions[i * 6 + 1] = y; precipitationPositions[i * 6 + 2] = drop.z;
        precipitationPositions[i * 6 + 3] = x + (snowing ? .025 : windSpeed * .03); precipitationPositions[i * 6 + 4] = y + (snowing ? .025 : .65); precipitationPositions[i * 6 + 5] = drop.z;
      }); precipitationGeometry.attributes.position.needsUpdate = true;
    }
    controls.update(); renderer.render(activeScene, camera); labels.update(activeRoom === "outside"); visitorLabels.update(activeScene, (object) => object !== clerk.object || activeRoom === "cafe");
    if (now - lastPositionSave > 1000) { savePosition(); lastPositionSave = now; }
    animationFrame = requestAnimationFrame(tick);
  }
  animationFrame = requestAnimationFrame(tick);

  return {
    perform(type) {
      cancel(); 
      const candidates = berries.filter((b) => type === "water" || b.ready).sort((a, b) => Math.hypot(a.x - farmer.position.x, a.z - farmer.position.z) - Math.hypot(b.x - farmer.position.x, b.z - farmer.position.z));
      const berry = candidates[0]; if (!berry) return Promise.resolve("empty");
      if (posture !== "stand" || !nearBed() || (type === "harvest" && Math.hypot(berry.x - farmer.position.x, berry.z - farmer.position.z) >= 1.8)) return Promise.resolve("far");
      farmer.rotation.y = Math.atan2(berry.x - farmer.position.x, berry.z - farmer.position.z);
      return new Promise<Outcome>((resolve) => { currentAction = { type, berry, resolve, phase: "acting", time: performance.now() }; });
    },
    cancel,
    pose(type) {
      cancel(); if (posture !== "stand") { standUp(); return; }
      const spot = type === "sit" ? nearestSeat() : nearestLounger(); if (!spot) return;
      const original = farmer.position.clone(); farmer.position.set(spot.x, 0, spot.z); farmer.rotation.y = spot.angle; poseExit = original; posture = type;
    },
    setBasket(count) { basketCount = count; },
    setBag(count) { packed.visible = count > 0; },
    setDrink(value) { drinkHeld = value; },
    setPaused(value) { paused = value; if (value) clearKeys(); },
    setName(name) { visitorLabels.setName(farmer, name); },
    getPose() { return { x: farmer.position.x, z: farmer.position.z, angle: farmer.rotation.y, action: posture !== "stand" ? posture : paused ? zoneLatched || "walk" : currentAction?.type || "walk", basket: basketCount, room: activeRoom }; },
    setPlayers(players) {
      const activeIds = new Set(players.map((player) => player.id));
      remotePeople.forEach((remote, id) => { if (!activeIds.has(id)) { remote.object.removeFromParent(); visitorLabels.remove(remote.object); remote.clothes.dispose(); remotePeople.delete(id); } });
      players.forEach((player) => {
        if (![player.x, player.z, player.angle].every(Number.isFinite) || player.x < MAP_BOUNDS.minX || player.x > MAP_BOUNDS.maxX || player.z < MAP_BOUNDS.minZ || player.z > MAP_BOUNDS.maxZ) return;
        let remote = remotePeople.get(player.id);
        if (!remote) { const avatar = person(player.name, "#7893a0"); avatar.object.position.set(player.x, 0, player.z); remote = { ...avatar, target: new THREE.Vector3(player.x, 0, player.z), angle: player.angle, action: player.action, name: player.name, room: player.room || "outside" }; remotePeople.set(player.id, remote); }
        if (remote.name !== player.name) { remote.name = player.name; visitorLabels.setName(remote.object, player.name); }
        remote.target.set(player.x, 0, player.z); remote.angle = player.angle; remote.action = player.action; remote.room = player.room || "outside"; remote.object.visible = remote.room === activeRoom; (remote.room === activeRoom ? activeScene : scene).add(remote.object);
        const carried = remote.object.getObjectByName("harvest-basket"); if (carried) carried.visible = player.basket > 0;
        const watering = remote.object.getObjectByName("water-can"); if (watering) watering.visible = player.action === "water";
      });
    },
    inspectBed() {
      if (inspecting) { stopInspecting(); return; }
      if (!nearBed()) return;
      stopWalking();
      const bed = [...beds].sort((a, b) => Math.hypot(a.x - farmer.position.x, a.z - farmer.position.z) - Math.hypot(b.x - farmer.position.x, b.z - farmer.position.z))[0];
      inspectView = { position: camera.position.clone(), target: controls.target.clone(), min: controls.minDistance, max: controls.maxDistance }; inspecting = true; controls.minDistance = .7; controls.maxDistance = 7;
      const side = farmer.position.x >= bed.x ? 1 : -1; camera.position.set(bed.x + side * 1.8, 2.3, farmer.position.z + 1.1); controls.target.set(bed.x, 1.5, farmer.position.z); controls.update();
    },
    setWeather(weather) {
      const night = weather.phase === "night", sunset = weather.phase === "sunset", cloud = weather.cloud / 100;
      windSpeed = weather.wind; windStrength = Math.min(.1, .012 + weather.wind * .008); snowing = weather.snow > 0 || (weather.code >= 71 && weather.code <= 77) || weather.code === 85 || weather.code === 86;
      rain.visible = !snowing && weather.precipitation > 0; snow.visible = snowing && weather.precipitation > 0; dustPoints.visible = !night && !rain.visible && !snow.visible;
      sunlight.color.set(night ? "#b8d3ee" : sunset ? "#ffd0a0" : "#fff1d9"); sunlight.intensity = night ? .75 : (sunset ? 2.6 : 3) * (1 - cloud * .65); sunlight.position.set(sunset ? -62 : -34, night ? 45 : sunset ? 27 : 65, 24);
      hemi.color.set(night ? "#bdcbdc" : sunset ? "#f3d7c4" : "#fcf8ec"); hemi.intensity = night ? 1.05 : 2.1 - cloud * .4; fill.intensity = night ? .35 : .8;
      (scene.fog as THREE.FogExp2).color.set(night ? "#657781" : weather.precipitation > 0 ? "#a4b3b4" : sunset ? "#e1d5bd" : "#e1e9d8");
      Object.entries(roomScenes).forEach(([id, room]) => { if (id.startsWith("house")) (room.background as THREE.Color).set(night ? "#5c6d75" : "#d8dfd1"); });
    },
    setReducedMotion(value) { reducedMotion = value; controls.enableDamping = !value; if (value) swaying.forEach((s) => s.mesh.rotation.z = s.origin); },
    zoom(factor) { const offset = camera.position.clone().sub(controls.target); const distance = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance); camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(distance)); controls.update(); },
    resetCamera,
    dispose() {
      savePosition(); disposed = true; cancel(); cancelAnimationFrame(animationFrame); resizeObserver.disconnect(); controls.dispose(); labels.dispose(); visitorLabels.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointerDown); renderer.domElement.removeEventListener("pointermove", pointerMove); renderer.domElement.removeEventListener("pointerup", pointerUp); renderer.domElement.removeEventListener("pointercancel", clearKeys); renderer.domElement.removeEventListener("keydown", keyDown); renderer.domElement.removeEventListener("blur", clearKeys);
      window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", clearKeys);
      window.removeEventListener("pagehide", savePosition); document.removeEventListener("visibilitychange", saveOnHide);
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
      [scene, ...Object.values(roomScenes)].forEach((root) => root.traverse((object) => { const renderable = object as THREE.Mesh; if (renderable.geometry) geometries.add(renderable.geometry); if (renderable.material) (Array.isArray(renderable.material) ? renderable.material : [renderable.material]).forEach((m) => materials.add(m)); }));
      materials.forEach((m) => { Object.values(m).forEach((v) => { if (v instanceof THREE.Texture) textures.add(v); }); m.dispose(); });
      geometries.forEach((g) => g.dispose()); textures.forEach((texture) => texture.dispose()); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
