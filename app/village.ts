import * as THREE from "three";
import { HOUSE_CENTERS, PADDY_PLOTS } from "./locations";
export { HOUSE_CENTERS } from "./locations";
import { groundHeight, MOUNTAIN_TRAIL } from "./terrain";

export type Station = "sorting" | "packing" | "cafe";
export type RoomId = "outside" | "cafe" | "sorting" | "house-0" | "house-1" | "house-2" | "house-3" | "house-4" | "house-5";
export type VillageBerry = { mesh: THREE.Mesh; x: number; z: number; aisle: number; growAt: number; ready: boolean };
type Pose = { p: number[]; s: number[]; r?: number[] };

export function buildVillage(scene: THREE.Object3D) {
  const rooms: Record<string, THREE.Group> = {};
  let activeParent: THREE.Object3D = scene;
  const obstacles: { x: number; z: number; w: number; d: number }[] = [];
  const berries: VillageBerry[] = [];
  const beds: { x: number; z: number; w: number; d: number }[] = [];
  const swaying: { mesh: THREE.Object3D; origin: number; phase: number }[] = [];
  const pondRipples: THREE.Mesh[] = [];
  const interactive: THREE.Object3D[] = [];
  const placeLabels: { object: THREE.Object3D; text: string }[] = [];
  const seats: { x: number; z: number; angle: number }[] = [];
  const loungers: { x: number; z: number; angle: number }[] = [];
  const cutaways: { object: THREE.Mesh; x: number; z: number; w: number; d: number }[] = [];
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1), sphereGeometry = new THREE.SphereGeometry(1, 10, 8), cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  const standard = (color: string, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
  const m = { grass: standard("#8fa56f"), bank: standard("#788d55"), path: standard("#c4b48f"), white: standard("#e8e8db"), wood: standard("#af8c62"), darkwood: standard("#6b6550"), steel: standard("#8a968b", { roughness: 0.5, metalness: 0.25 }), leaf: standard("#62864e"), flower: standard("#fff7de"), pollen: standard("#deb354"), water: standard("#809a80", { roughness: 0.2, metalness: 0.16 }) };
  let seed = 427;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, p: number[], s = [1, 1, 1], parent: THREE.Object3D = activeParent) {
    const object = new THREE.Mesh(geometry, material); object.position.set(p[0], p[1], p[2]); object.scale.set(s[0], s[1], s[2]); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  const box = (p: number[], s: number[], material = m.wood, parent: THREE.Object3D = activeParent) => mesh(boxGeometry, material, p, s, parent);
  const ball = (p: number[], s: number[], material: THREE.Material, parent: THREE.Object3D = activeParent) => mesh(sphereGeometry, material, p, s, parent);
  const cylinder = (p: number[], s: number[], material: THREE.Material, parent: THREE.Object3D = activeParent) => mesh(cylinderGeometry, material, p, s, parent);
  function batch(geometry: THREE.BufferGeometry, material: THREE.Material, poses: Pose[]) {
    const result = new THREE.InstancedMesh(geometry, material, poses.length), dummy = new THREE.Object3D();
    poses.forEach((p, i) => { dummy.position.set(...p.p as [number, number, number]); dummy.scale.set(...p.s as [number, number, number]); dummy.rotation.set(...(p.r || [0, 0, 0]) as [number, number, number]); dummy.updateMatrix(); result.setMatrixAt(i, dummy.matrix); });
    result.castShadow = true; result.receiveShadow = true; activeParent.add(result); return result;
  }
  function label(text: string, p: number[]) {
    const object = new THREE.Object3D(); object.position.set(...p as [number, number, number]); activeParent.add(object);
    placeLabels.push({ object, text }); return object;
  }
  function station(object: THREE.Object3D, name: Station) { object.userData.station = name; interactive.push(object); }
  const ground = mesh(new THREE.CircleGeometry(170, 80), m.grass, [0, -0.08, 0]); ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
  const terrainGeometry = new THREE.PlaneGeometry(150, 150, 84, 84); terrainGeometry.rotateX(-Math.PI / 2); terrainGeometry.translate(0, 0, -20);
  const terrainVertices = terrainGeometry.getAttribute("position"), terrainColors: number[] = [];
  for (let i = 0; i < terrainVertices.count; i++) {
    const height = groundHeight(terrainVertices.getX(i), terrainVertices.getZ(i)); terrainVertices.setY(i, height);
    const color = new THREE.Color("#8ea576").lerp(new THREE.Color("#a8ad8c"), height / 22); terrainColors.push(color.r, color.g, color.b);
  }
  terrainGeometry.setAttribute("color", new THREE.Float32BufferAttribute(terrainColors, 3)); terrainGeometry.computeVertexNormals();
  const terrain = mesh(terrainGeometry, standard("#ffffff", { vertexColors: true }), [0, 0, 0]); terrain.castShadow = false;
  const trailVertices: number[] = [];
  for (let i = 1; i < MOUNTAIN_TRAIL.length; i++) {
    const [ax, az] = MOUNTAIN_TRAIL[i - 1], [bx, bz] = MOUNTAIN_TRAIL[i], length = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / length * .95, nz = (bx - ax) / length * .95;
    for (let step = 0; step < 16; step++) {
      const points = [step / 16, (step + 1) / 16].flatMap((fraction) => [-1, 1].map((side) => {
        const x = ax + (bx - ax) * fraction + nx * side, z = az + (bz - az) * fraction + nz * side;
        return [x, groundHeight(x, z) + .025, z];
      }));
      for (const vertex of [0, 1, 2, 1, 3, 2]) trailVertices.push(...points[vertex]);
    }
  }
  const trailGeometry = new THREE.BufferGeometry(); trailGeometry.setAttribute("position", new THREE.Float32BufferAttribute(trailVertices, 3)); trailGeometry.computeVertexNormals();
  mesh(trailGeometry, standard("#c9b68e", { side: THREE.DoubleSide }), [0, 0, 0]);
  label("뒷산 산책길", [0, 2.2, -31]); label("뒷산 정상", [0, 24.2, -66]);
  for (let i = 0; i < 18; i++) {
    const x = -95 + i * 11, z = -116 - random() * 22;
    const hill = ball([x, -2, z], [13 + random() * 15, 7 + random() * 12, 14 + random() * 14], standard(["#9cad8c", "#849d85", "#a0af92"][i % 3])); hill.castShadow = false;
  }
  // Connected rural lanes, with narrow irrigation channels alongside them.
  for (const x of [-30, -10, 10, 30]) {
    box([x, 0.015, 0], [2.7, 0.07, 58], m.path);
    if (x !== -30) box([x - 1.8, 0.005, 0], [0.48, 0.035, 57.5], m.water);
  }
  for (const z of [-27, -9, 9, 27, 47]) {
    box([0, 0.02, z], [126, 0.08, 2.7], m.path);
    box([0, 0.005, z - 1.8], [124, 0.025, 0.46], m.water);
    for (const x of [-30, -10, 10, 30]) box([x - 1.6, 0.075, z], [1.4, 0.12, 3.05], m.path);
  }
  for (const x of [-62, 62]) box([x, .02, 7], [2.7, .08, 80], m.path);
  const greenRice: Pose[] = [], goldRice: Pose[] = [], ears: Pose[] = [];
  function paddy(x: number, z: number, gold = false, width = 16.2, depth = 14.2, blocking = true) {
    box([x, 0.015, z], [width, 0.06, depth], m.water);
    for (const side of [-1, 1]) { box([x + side * (width / 2 + 0.15), 0.11, z], [0.32, 0.24, depth + 0.7], m.bank); box([x, 0.11, z + side * (depth / 2 + 0.15)], [width, 0.24, 0.32], m.bank); }
    // The fields are walkable too; only structures and cultivation tables block movement.
    const cols = Math.floor(width / 0.66), rows = Math.floor(depth / 0.7);
    for (let ix = 0; ix < cols; ix++) for (let iz = 0; iz < rows; iz++) {
      const px = x + (ix - (cols - 1) / 2) * 0.66, pz = z + (iz - (rows - 1) / 2) * 0.7;
      const height = 0.55 + random() * 0.2;
      for (let j = 0; j < 3; j++) (gold ? goldRice : greenRice).push({ p: [px + (random() - 0.5) * 0.15, 0.08, pz], s: [1, height, 1], r: [0, j * 2.1 + random(), (random() - 0.5) * 0.25] });
      if (gold && ix % 2 === 0) ears.push({ p: [px + 0.08, height + 0.03, pz], s: [0.05, 0.19, 0.05], r: [0, 0, -0.45] });
    }
  }
  PADDY_PLOTS.forEach(({ x, z, gold, width, depth }) => paddy(x, z, gold, width, depth, false));
  const blade = new THREE.BufferGeometry(); blade.setAttribute("position", new THREE.Float32BufferAttribute([-.05, 0, 0, .07, 0, 0, .15, 1, .03], 3)); blade.computeVertexNormals();
  batch(blade, standard("#6f9147", { side: THREE.DoubleSide }), greenRice);
  batch(blade, standard("#b9ad56", { side: THREE.DoubleSide }), goldRice);
  batch(sphereGeometry, standard("#c5a65b"), ears);

  const loader = new THREE.TextureLoader();
  const leafTexture = loader.load("/textures/strawberry-leaf.webp"); leafTexture.colorSpace = THREE.SRGBColorSpace;
  const earthTexture = loader.load("/textures/farm-earth.webp"); earthTexture.colorSpace = THREE.SRGBColorSpace; earthTexture.wrapS = earthTexture.wrapT = THREE.RepeatWrapping; earthTexture.repeat.set(1, 3);
  const leafMaterial = standard("#bed0a4", { map: leafTexture, side: THREE.DoubleSide }), earthMaterial = standard("#938467", { map: earthTexture });
  const leafShape = new THREE.Shape();
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, tooth = i % 2 ? .9 : 1, x = Math.sin(a) * .32 * tooth, y = .4 + Math.cos(a) * .42 * tooth; if (i) leafShape.lineTo(x, y); else leafShape.moveTo(x, y); }
  leafShape.closePath(); const leafGeometry = new THREE.ShapeGeometry(leafShape), uv = leafGeometry.getAttribute("uv"); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + .5, uv.getY(i));
  const leaves: Pose[] = [], flowers: Pose[] = [], centers: Pose[] = [], legs: Pose[] = [];
  const fruitCanvas = document.createElement("canvas"); fruitCanvas.width = fruitCanvas.height = 128; const fc = fruitCanvas.getContext("2d")!; fc.fillStyle = "#cb5a46"; fc.fillRect(0, 0, 128, 128);
  for (let y = 12; y < 128; y += 20) for (let x = 10; x < 128; x += 20) { fc.fillStyle = "#efc88b"; fc.beginPath(); fc.ellipse(x + (y % 40 ? 8 : 0), y, 1.3, 2.5, 0, 0, Math.PI * 2); fc.fill(); }
  const fruitMap = new THREE.CanvasTexture(fruitCanvas); fruitMap.colorSpace = THREE.SRGBColorSpace; const fruitMaterial = standard("#ffffff", { map: fruitMap, roughness: .65 });
  const profile: THREE.Vector2[] = []; for (let i = 0; i <= 14; i++) { const t = i / 14; profile.push(new THREE.Vector2(Math.pow(Math.sin(Math.PI * t), .7) * (1.05 - t * .43) * .18, .2 - t * .43)); }
  const fruitGeometry = new THREE.LatheGeometry(profile, 10), frameGeometry = new THREE.CylinderGeometry(.033, .033, 1, 6), frameMatrices: THREE.Matrix4[] = [], dummy = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
  function rod(a: THREE.Vector3, b: THREE.Vector3, thickness = 1) { const direction = b.clone().sub(a); dummy.position.copy(a).add(b).multiplyScalar(.5); dummy.quaternion.setFromUnitVectors(up, direction.clone().normalize()); dummy.scale.set(thickness, direction.length(), thickness); dummy.updateMatrix(); frameMatrices.push(dummy.matrix.clone()); }
  const glass = new THREE.MeshPhysicalMaterial({ color: "#e7efdc", transparent: true, opacity: .16, roughness: .25, metalness: .1, side: THREE.DoubleSide, depthWrite: false });
  function greenhouse(cx: number, cz: number, index: number) {
    const root = new THREE.Group(); root.name = `house-${index}`; scene.add(root); rooms[root.name] = root; activeParent = root;
    const leafStart = leaves.length, flowerStart = flowers.length, centerStart = centers.length, legStart = legs.length, frameStart = frameMatrices.length;
    const w = 6.8, length = 12.7, eave = 2.25, rise = 2.3;
    box([cx, 0, cz], [w, .07, length], standard("#c6c2a8"));
    // Keep side walls solid and leave a doorway at both ends of the vestibule.
    for (const side of [-1, 1]) {
      obstacles.push({ x: cx + side * w / 2, z: cz, w: .12, d: length });
      const panel = mesh(new THREE.PlaneGeometry(length, eave), glass, [cx + side * w / 2, eave / 2, cz]); panel.rotation.y = Math.PI / 2; panel.castShadow = false;
      for (const end of [-1, 1]) {
        obstacles.push({ x: cx + side * 2.2, z: cz + end * length / 2, w: 2.4, d: .12 });
        const endPanel = mesh(new THREE.PlaneGeometry(2.4, eave), glass, [cx + side * 2.2, eave / 2, cz + end * length / 2]); endPanel.castShadow = false;
      }
    }
    const positions: number[] = [], indices: number[] = [];
    for (let j = 0; j <= 1; j++) for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI; positions.push(cx + Math.cos(a) * w / 2, eave + Math.sin(a) * rise, cz - length / 2 + j * length); if (!j && i < 24) indices.push(i, i + 1, i + 25, i + 1, i + 26, i + 25); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); const roof = mesh(geometry, glass, [0, 0, 0]); roof.castShadow = false;
    for (let j = 0; j < 8; j++) {
      const z = cz - length / 2 + j * length / 7;
      for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI, b = (k + 1) / 14 * Math.PI; rod(new THREE.Vector3(cx + Math.cos(a) * w / 2, eave + Math.sin(a) * rise, z), new THREE.Vector3(cx + Math.cos(b) * w / 2, eave + Math.sin(b) * rise, z)); }
      for (const side of [-1, 1]) rod(new THREE.Vector3(cx + side * w / 2, 0, z), new THREE.Vector3(cx + side * w / 2, eave, z), 1.3);
    }
    for (let k = 0; k <= 4; k++) { const a = k / 4 * Math.PI, x = cx + Math.cos(a) * w / 2, y = eave + Math.sin(a) * rise; rod(new THREE.Vector3(x, y, cz - length / 2), new THREE.Vector3(x, y, cz + length / 2)); }
    for (const offset of [-2.25, 0, 2.25]) {
      const x = cx + offset; box([x, 1.1, cz], [.8, .32, 10.4], m.white); box([x, 1.27, cz], [.66, .025, 10.3], earthMaterial);
      obstacles.push({ x, z: cz, w: 1.05, d: 10.6 }); beds.push({ x, z: cz, w: .8, d: 10.4 });
      for (let n = 0; n < 5; n++) for (const sign of [-1, 1]) legs.push({ p: [x + sign * .28, .5, cz - 4.6 + n * 2.3], s: [.025, 1, .025] });
      for (let n = 0; n < 13; n++) {
        const z = cz - 4.56 + n * .76;
        for (let l = 0; l < 4; l++) leaves.push({ p: [x, 1.43, z], s: [.68, .71, .68], r: [-.9 + random() * .2, 0, l * Math.PI / 2 + random() * .25] });
        const fx = x + .18, fz = z + .12; centers.push({ p: [fx, 1.64, fz], s: [.045, .025, .045] });
        for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; flowers.push({ p: [fx + Math.cos(a) * .07, 1.63, fz + Math.sin(a) * .07], s: [.07, .018, .045] }); }
        if (n % 2 === 0) {
          const bx = x + (offset < 0 ? .4 : -.4); const fruit = mesh(fruitGeometry, fruitMaterial, [bx, 1.25, z], [.9, .9, .9]);
          berries.push({ mesh: fruit, x: bx, z, aisle: x + (offset < 0 ? 1.1 : -1.1), ready: true, growAt: 0 });
        }
      }
    }
    const front = cz + length / 2;
    for (const end of [-1, 1]) box([cx, .05, cz + end * (length / 2 + 1.1)], [1.5, .1, 2.2], m.path);
    box([cx, 2.65, front + .025], [2.1, .46, .09], m.wood).name = "house-front-sign";
    label("딸기 하우스", [cx, 5.25, cz]);
    for (const end of [-1, 1]) for (const x of [cx - .8, cx + .8]) rod(new THREE.Vector3(x, .02, cz + end * length / 2), new THREE.Vector3(x, 2.5, cz + end * length / 2), 1.25);
    const matrices = frameMatrices.slice(frameStart), frames = new THREE.InstancedMesh(frameGeometry, m.white, matrices.length); matrices.forEach((matrix, i) => frames.setMatrixAt(i, matrix)); frames.castShadow = true; frames.receiveShadow = true; root.add(frames);
    batch(leafGeometry, leafMaterial, leaves.slice(leafStart)); batch(cylinderGeometry, m.steel, legs.slice(legStart)); batch(sphereGeometry, m.flower, flowers.slice(flowerStart)); batch(sphereGeometry, m.pollen, centers.slice(centerStart));
    activeParent = scene;
  }
  HOUSE_CENTERS.forEach(([x, z], i) => greenhouse(x, z, i));

  function tree(x: number, z: number, size = 1) {
    const group = new THREE.Group(); group.position.set(x, groundHeight(x, z), z); group.scale.setScalar(size); scene.add(group);
    mesh(new THREE.CylinderGeometry(.12, .22, 3.3, 7), m.darkwood, [0, 1.65, 0], [1, 1, 1], group);
    const canopy = new THREE.Group(); group.add(canopy);
    for (let j = 0; j < 7; j++) { const a = j / 7 * Math.PI * 2; ball([Math.cos(a) * .9, 3.4 + random() * 1.2, Math.sin(a) * .85], [1.15, 1.4, 1.1], standard(j % 2 ? "#63834e" : "#81975d"), canopy); }
    ball([0, 4.6, 0], [1.1, 1.25, 1.1], m.leaf, canopy); swaying.push({ mesh: canopy, origin: 0, phase: random() * 9 });
    obstacles.push({ x, z, w: 1, d: 1 });
  }
  for (const [x, z, s] of [[-33, -23, 1.1], [-33, 11, 1.2], [-33, 30, 1], [33, -29, 1.1], [33, -4, 1.2], [33, 27, 1.1], [13, -29, .85], [-12, -30, 1]]) tree(x, z, s);
  for (let i = 0; i < 12; i++) tree(-55 + i * 10, -40 - random() * 5, .8 + random() * .7);
  for (const [x, z] of [[-30, -50], [28, -51], [-25, -65], [29, -70], [-13, -77], [12, -80], [-55, 33], [56, 31]]) tree(x, z, .85);
  // A cafe on the edge of the fields, with a front terrace.
  const cafeRoot = new THREE.Group(); cafeRoot.name = "cafe"; scene.add(cafeRoot); rooms.cafe = cafeRoot; activeParent = cafeRoot;
  const cafeWall = standard("#eee3ca"), cafeRoof = standard("#5f7568"), windowMat = standard("#78978e", { metalness: .25, roughness: .18 }), awning = standard("#ad7860");
  box([21, .03, -.7], [8.2, .1, 5.8], standard("#c8b493"));
  box([21, 1.7, -3.6], [8.2, 3.4, .18], cafeWall); obstacles.push({ x: 21, z: -3.6, w: 8.5, d: .4 });
  for (const x of [16.9, 25.1]) { const wall = box([x, 1.7, -.7], [.18, 3.4, 5.8], cafeWall); station(wall, "cafe"); obstacles.push({ x, z: -.7, w: .4, d: 6.2 }); }
  const counter = box([21, .65, -1.2], [5.6, 1.3, .9], m.wood); box([21, 1.33, -1.2], [5.9, .09, 1.1], m.white); station(counter, "cafe"); obstacles.push({ x: 21, z: -1.2, w: 5.9, d: 1.1 });
  box([21, .9, -3.3], [7.3, 1.8, .4], m.wood);
  for (const x of [18.5, 19.2, 19.9]) cylinder([x, 2.0, -3.1], [.14, .23, .14], m.white);
  box([22.8, 1.8, -3.05], [1.1, .8, .6], m.steel);
  for (const side of [-1, 1]) { const roof = box([21 + side * 2.15, 3.95, -.7], [4.6, .18, 6.6], cafeRoof); roof.rotation.z = side * -.26; station(roof, "cafe"); }
  for (const x of [18.5, 23.4]) {
    box([x, 1.75, 2.24], [2.3, 1.9, .07], m.wood); box([x, 1.75, 2.29], [2.1, 1.7, .07], windowMat);
    box([x, 1.75, 2.34], [.06, 1.7, .05], m.white); box([x, 1.75, 2.34], [2.1, .06, .05], m.white);
  }
  const cafeDoor = box([21.95, 1.25, 2.2], [.1, 2.5, 1.15], m.darkwood); station(cafeDoor, "cafe");
  box([21, 3.05, 3.1], [8.5, .12, 1.8], awning);
  for (let i = 0; i < 11; i++) if (i % 2) box([17.1 + i * .78, 3.12, 3.1], [.38, .03, 1.8], m.white);
  box([21, .08, 5.2], [10, .16, 5.0], standard("#bda784"));
  const cafeSign = label("딸기 카페", [21, 5.45, .2]); station(cafeSign, "cafe");
  const cupMaterial = standard("#f3d3c7");
  for (const x of [19, 23]) {
    cylinder([x, .82, 5.4], [.85, .12, .85], m.wood); cylinder([x, .4, 5.4], [.07, .8, .07], m.steel);
    for (const side of [-1, 1]) { const z = 5.4 + side * 1.25; cylinder([x, .48, z], [.35, .1, .35], m.wood); cylinder([x, .24, z], [.055, .45, .055], m.steel); seats.push({ x, z, angle: side > 0 ? Math.PI : 0 }); }
    cylinder([x + .15, 1.04, 5.35], [.12, .29, .12], cupMaterial); cylinder([x + .15, 1.20, 5.35], [.125, .035, .125], m.white);
  }
  activeParent = scene;
  for (const x of [-66, 66]) for (const z of [-25, -6, 14, 36]) tree(x, z, .75);
  tree(14.3, -3.8, .8); tree(27, 5.7, .8);

  // Open-front sorting and packing workshop; the stations are part of the village.
  const sortingRoot = new THREE.Group(); sortingRoot.name = "sorting"; scene.add(sortingRoot); rooms.sorting = sortingRoot; activeParent = sortingRoot;
  const packingWall = standard("#d5d9c9"), packingRoof = standard("#8b9b8e"), crate = standard("#68806a");
  for (const x of [-3.7, 3.7]) { box([x, 1.65, 16.4], [4.6, 3.3, .18], packingWall); obstacles.push({ x, z: 16.4, w: 4.9, d: .45 }); }
  box([0, 2.95, 16.4], [2.8, .7, .18], packingWall);
  box([0, .04, 13], [2.4, .08, 7], m.path);
  for (const x of [-6, 6]) { box([x, 1.65, 19.4], [.18, 3.3, 6.2], packingWall); obstacles.push({ x, z: 19.4, w: .5, d: 6.5 }); }
  const workshopRoof = box([0, 3.6, 19.4], [13, .2, 7.3], packingRoof); workshopRoof.rotation.x = -.06; station(workshopRoof, "sorting"); cutaways.push({ object: workshopRoof, x: 0, z: 20, w: 17, d: 12 });
  box([0, .015, 20.2], [12.5, .08, 7.5], standard("#c9c5af"));
  box([0, .05, 25], [3.1, .1, 4.5], m.path);
  const workshopLabel = label("딸기 선별장", [0, 5.2, 19]); station(workshopLabel, "sorting");
  const sortingTable = box([0, .9, 20.8], [8.8, .18, 1.6], m.white); station(sortingTable, "sorting"); obstacles.push({ x: 0, z: 20.8, w: 9.1, d: 1.9 });
  for (const x of [-3.8, 0, 3.8]) for (const dz of [-.55, .55]) box([x, .44, 20.8 + dz], [.09, .9, .09], m.steel);
  for (let i = 0; i < 7; i++) box([-3.4 + i * 1.12, 1.12, 20.8], [.85, .23, 1.1], i < 3 ? crate : standard("#d4d9ca"));
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) box([7.4 + j * .9, .25 + i * .5, 20.3], [.8, .45, 1.2], crate);
  obstacles.push({ x: 8.3, z: 20.3, w: 2.6, d: 1.2 });

  activeParent = scene;
  // A rest stop by the outer lane.
  const bench = new THREE.Group(); bench.position.set(-33.2, 0, 13.4); scene.add(bench);
  for (let i = 0; i < 4; i++) box([0, .65, (i - 1.5) * .17], [2.7, .09, .14], m.wood, bench);
  for (let i = 0; i < 3; i++) box([0, .95 + i * .17, -.32], [2.7, .11, .1], m.wood, bench);
  for (const x of [-1, 1]) for (const z of [-.23, .23]) box([x, .31, z], [.1, .62, .1], m.steel, bench);
  obstacles.push({ x: -33.2, z: 13.4, w: 2.9, d: .9 }); seats.push({ x: -33.2, z: 13.4, angle: 0 });
  const deck = box([-33, .54, 19.2], [2.9, .22, 4.2], m.wood);
  for (let i = 0; i < 11; i++) box([-33, .665, 17.3 + i * .38], [2.85, .025, .025], m.darkwood);
  box([-33, .71, 19], [2.2, .1, 3.4], standard("#d8c7a5")); box([-33, .83, 17.7], [1.2, .22, .55], m.white);
  for (const x of [-34.1, -31.9]) for (const z of [17.5, 20.9]) box([x, .26, z], [.15, .52, .15], m.darkwood);
  obstacles.push({ x: -33, z: 19.2, w: 2.9, d: 4.2 }); loungers.push({ x: -33, z: 19.2, angle: 0 }); label("평상", [-33, 2.7, 19.2]);

  // Rural utility poles and wires sit at the edges, away from the footpaths.
  const cableMaterial = new THREE.LineBasicMaterial({ color: "#71826b", transparent: true, opacity: .5 });
  for (let i = 0; i < 5; i++) {
    const z = -30 + i * 15; cylinder([-35.5, 3.4, z], [.09, 6.8, .09], standard("#aaa892")); box([-35.5, 6.4, z], [1.9, .09, .1], m.darkwood);
    if (i < 4) for (const dx of [-.65, .65]) { const points = []; for (let k = 0; k <= 12; k++) { const t = k / 12; points.push(new THREE.Vector3(-35.5 + dx, 6.45 - Math.sin(t * Math.PI) * .65, z + t * 15)); } scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), cableMaterial)); }
  }
  return { obstacles, berries, beds, swaying, pondRipples, interactive, cutaways, seats, loungers, rooms, placeLabels, terrain };
}
