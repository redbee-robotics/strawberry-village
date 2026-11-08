export const HOUSE_CENTERS = [[-5.7, -19], [5.7, -19], [-5.7, 1], [5.7, 1], [-56, 1], [56, 1]];
export type PaddyPlot = { x: number; z: number; width: number; depth: number; gold: boolean };
export const PADDY_PLOTS: PaddyPlot[] = [
  ...[[-20, -18, 1], [20, -18, 0], [-20, 0, 0], [-20, 18, 1], [20, 18, 1]].map(([x, z, gold]) => ({ x, z, width: 16.2, depth: 14.2, gold: !!gold })),
  ...[-43, 43].flatMap((x) => [-18, 0, 18].map((z, i) => ({ x, z, width: 17, depth: 14.2, gold: (i + (x > 0 ? 1 : 0)) % 2 === 0 }))),
  ...[-49, -20, 20, 49].map((x, i) => ({ x, z: 38, width: 17, depth: 13, gold: i % 2 === 0 })),
  ...[-56, 56].map((x) => ({ x, z: -18, width: 7, depth: 14.2, gold: x < 0 })),
];
