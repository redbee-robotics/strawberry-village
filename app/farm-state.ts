export const PACK_SIZE = 12;
export const LEGACY_PACK_SIZE = 4;
export type Grade = "large" | "regular" | "processing";
export type PickedBerry = { id: string; grade: Grade; weight: number };
export type FarmSave = {
  raw: PickedBerry[];
  sorted: Record<Grade, number>;
  boxes: number;
  harvested: number;
  watered: number;
  drinks: number;
  packs?: PickedBerry[][];
};
export const blankSave: FarmSave = { raw: [], sorted: { large: 0, regular: 0, processing: 0 }, boxes: 0, harvested: 0, watered: 0, drinks: 0 };
export const gradeNames: Record<Grade, string> = { large: "큰 딸기", regular: "작은 딸기", processing: "라떼용 딸기" };
export function pickedBerry(index: number): PickedBerry {
  const grade: Grade = (["large", "regular", "processing", "large", "regular", "large", "processing", "regular"] as Grade[])[index % 8];
  return { id: `berry-${index}-${Date.now()}`, grade, weight: grade === "large" ? 32 + index % 6 : grade === "regular" ? 21 + index % 7 : 25 + index % 4 };
}
const count = (value: unknown) => Math.max(0, Math.min(100000, Math.floor(Number(value) || 0)));
export function readSave(value: unknown): FarmSave {
  if (!value || typeof value !== "object") return { ...blankSave, raw: [], sorted: { ...blankSave.sorted } };
  const record = value as Partial<FarmSave> & { berries?: number };
  const validBerry = (b: PickedBerry) => b && ["large", "regular", "processing"].includes(b.grade) && typeof b.id === "string" && Number.isFinite(b.weight);
  const raw = Array.isArray(record.raw) ? record.raw.filter(validBerry).slice(0, 100000) : Array.from({ length: count(record.berries) }, (_, i) => pickedBerry(i));
  const boxes = count(record.boxes);
  const packs = Array.isArray(record.packs) ? record.packs.filter((pack) => Array.isArray(pack) && [LEGACY_PACK_SIZE, PACK_SIZE].includes(pack.length) && pack.every(validBerry)).slice(-boxes || Infinity) : [];
  return { raw, sorted: { large: count(record.sorted?.large), regular: count(record.sorted?.regular), processing: count(record.sorted?.processing) }, boxes, packs: boxes ? packs : [], harvested: Math.max(count(record.harvested), raw.length), watered: count(record.watered), drinks: count(record.drinks) };
}
export const totalBerries = (s: FarmSave) => s.raw.length + s.sorted.large + s.sorted.regular + s.sorted.processing;
export type PackSlots = (string | null)[];
export const emptyPackSlots = (): PackSlots => Array.from({ length: PACK_SIZE }, () => null);
export const packBerryCount = (state: FarmSave, index: number) => index < state.boxes - (state.packs?.length || 0) ? LEGACY_PACK_SIZE : state.packs?.[index - state.boxes + (state.packs?.length || 0)]?.length || LEGACY_PACK_SIZE;
export function movePackBerry(slots: PackSlots, id: string, target: number | null): PackSlots {
  const source = slots.indexOf(id);
  if (target === null) return slots.map((value) => value === id ? null : value) as PackSlots;
  if (!Number.isInteger(target) || target < 0 || target >= PACK_SIZE || source === target) return slots;
  const next = [...slots] as PackSlots;
  if (source >= 0) next[source] = next[target];
  next[target] = id;
  return next;
}
export function spendCafeBerries(state: FarmSave, cost: number): FarmSave | null {
  if (!Number.isInteger(cost) || cost <= 0 || cafeBerries(state) < cost) return null;
  const processing = Math.min(cost, state.sorted.processing);
  const rawUsed = Math.min(state.raw.length, cost - processing), missing = cost - processing - rawUsed;
  const packs = [...(state.packs || [])], unpacked: PickedBerry[] = [];
  let opened = 0;
  while (unpacked.length < missing) {
    const contents = packs.pop() || Array.from({ length: LEGACY_PACK_SIZE }, (_, j) => ({ ...pickedBerry(state.harvested + opened * LEGACY_PACK_SIZE + j), id: `opened-${crypto.randomUUID()}` }));
    unpacked.push(...contents); opened++;
  }
  return { ...state, raw: [...state.raw.slice(rawUsed), ...unpacked.slice(missing)], boxes: state.boxes - opened, packs, sorted: { ...state.sorted, processing: state.sorted.processing - processing }, drinks: state.drinks + 1 };
}
export const cafeBerries = (state: FarmSave) => state.raw.length + state.sorted.processing + Math.max(0, state.boxes - (state.packs?.length || 0)) * LEGACY_PACK_SIZE + (state.packs || []).reduce((sum, pack) => sum + pack.length, 0);

export function packFromBasket(state: FarmSave, ids: string[]): FarmSave | null {
  const selected = new Set(ids);
  if (ids.length !== PACK_SIZE || selected.size !== PACK_SIZE || ids.some((id) => !state.raw.some((berry) => berry.id === id))) return null;
  return { ...state, raw: state.raw.filter((berry) => !selected.has(berry.id)), boxes: state.boxes + 1, packs: [...(state.packs || []), ids.map((id) => state.raw.find((berry) => berry.id === id)!)] };
}
