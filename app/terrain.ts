export const MAP_BOUNDS = { minX: -70, maxX: 70, minZ: -92, maxZ: 50 };
export const MOUNTAIN_TRAIL = [[0, -30], [-14, -38], [18, -46], [-12, -54], [14, -62], [0, -66]];
export function groundHeight(x: number, z: number) {
  if (z >= -34) return 0;
  const radius = (x / 44) ** 2 + ((z + 66) / 32) ** 2;
  return 22 * Math.max(0, 1 - radius) ** 2;
}
