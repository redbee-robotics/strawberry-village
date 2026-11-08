export const encodePosition = (x: number, z: number) => ({ x: Math.round(x * 50) / 100, z: Math.round(z / 3 * 100) / 100 });
export function decodePosition(id: string, x: number, z: number) {
  return id.startsWith("v2-") ? { x: x * 2, z: z * 3 } : { x, z };
}
