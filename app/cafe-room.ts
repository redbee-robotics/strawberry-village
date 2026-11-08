import * as THREE from "three";

export const CAFE_ROOM_BOUNDS = { minX: 9, maxX: 33, minZ: -12, maxZ: 9 };
export const CAFE_ENTRY = { x: 21, z: 0 };
export const CAFE_EXIT = { x: 21, z: 3.2 };
export function buildCafeRoom() {
  const root = new THREE.Group(); root.name = "cafe-spacious-interior";
  const obstacles: { x: number; z: number; w: number; d: number }[] = [];
  const seats: { x: number; z: number; angle: number }[] = [];
  const material = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const wall = material("#eee3ca"), wood = material("#ad8760"), cream = material("#f2ecdd"), green = material("#718773"), dark = material("#6b6550");
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  function box(x: number, y: number, z: number, w: number, h: number, d: number, mat = wood) {
    const object = new THREE.Mesh(geometry, mat); object.position.set(x, y, z); object.scale.set(w, h, d);
    object.castShadow = object.receiveShadow = true; root.add(object); return object;
  }
  function solid(x: number, z: number, w: number, d: number, h: number, mat = wall) {
    box(x, h / 2, z, w, h, d, mat); obstacles.push({ x, z, w, d });
  }
  box(21, -0.06, -1.5, 24, 0.12, 21, material("#cab899"));
  box(21, 7.5, -1.5, 24, 0.18, 21, cream);
  solid(9, -1.5, 0.25, 21, 7.5); solid(33, -1.5, 0.25, 21, 7.5); solid(21, -12, 24, 0.25, 7.5);
  // The center doorway leads back outside; the camera stays within the room.
  solid(14, 9, 10, 0.25, 7.5); solid(28, 9, 10, 0.25, 7.5);
  box(21, 5.75, 9, 4, 3.5, 0.25, wall);
  for (const x of [18.9, 23.1]) box(x, 2, 8.8, 0.18, 4, 0.3, dark);
  box(21, 4.1, 8.8, 4.4, 0.2, 0.3, dark);
  solid(21, -7, 8.5, 1.5, 1.3, wood); box(21, 1.35, -7, 8.8, 0.12, 1.8, cream);
  solid(21, -11.4, 12, 0.7, 2, wood);
  for (const x of [16.5, 17.3, 18.1]) box(x, 2.2, -11.1, 0.3, 0.4, 0.3, cream);
  box(24, 2.4, -11, 1.5, 0.9, 0.8, green);
  for (const x of [13, 29]) for (const z of [-3, 3.5]) {
    solid(x, z, 2.2, 1.6, 0.9, wood);
    box(x, 0.94, z, 2.4, 0.12, 1.8, cream);
    for (const side of [-1, 1]) {
      const seatZ = z + side * 1.45;
      box(x, 0.45, seatZ, 0.8, 0.12, 0.8, green);
      box(x, 0.2, seatZ, 0.12, 0.4, 0.12, dark);
      box(x, 0.9, seatZ + side * 0.36, 0.8, 0.9, 0.12, green);
      seats.push({ x, z: seatZ, angle: side > 0 ? Math.PI : 0 });
    }
  }
  for (const x of [9.2, 32.8]) for (const z of [-5, 3]) {
    box(x, 3.3, z, 0.1, 2.5, 3.5, green);
    box(x + (x < 21 ? 0.06 : -0.06), 3.3, z, 0.1, 2.5, 0.08, cream);
  }
  // Invisible collision slab at the doorway prevents a zoomed-out camera leaving the room.
  const cameraBoundary = { min: { x: 9, y: 0, z: 8.85 }, max: { x: 33, y: 7.5, z: 9.15 } };
  return { root, obstacles, seats, cameraBoundary };
}
