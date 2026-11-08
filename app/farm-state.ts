export type Grade = "large" | "regular" | "processing";
export type PickedBerry = { id: string; grade: Grade; weight: number };
export type FarmSave = {
  raw: PickedBerry[];
  sorted: Record<Grade, number>;
  boxes: number;
  harvested: number;
  watered: number;
  drinks: number;
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
  const raw = Array.isArray(record.raw) ? record.raw.filter((b) => b && ["large", "regular", "processing"].includes(b.grade) && typeof b.id === "string" && Number.isFinite(b.weight)).slice(0, 2000) : Array.from({ length: Math.min(count(record.berries), 2000) }, (_, i) => pickedBerry(i));
  return { raw, sorted: { large: count(record.sorted?.large), regular: count(record.sorted?.regular), processing: count(record.sorted?.processing) }, boxes: count(record.boxes), harvested: Math.max(count(record.harvested), raw.length), watered: count(record.watered), drinks: count(record.drinks) };
}
export const totalBerries = (s: FarmSave) => s.raw.length + s.sorted.large + s.sorted.regular + s.sorted.processing;
export function spendCafeBerries(state: FarmSave, cost: number): FarmSave | null {
  if (state.raw.length + state.sorted.processing < cost) return null;
  const processing = Math.min(cost, state.sorted.processing);
  return { ...state, raw: state.raw.slice(cost - processing), sorted: { ...state.sorted, processing: state.sorted.processing - processing }, drinks: state.drinks + 1 };
}

export function packFromBasket(state: FarmSave, ids: string[]): FarmSave | null {
  const selected = new Set(ids);
  if (ids.length !== 4 || selected.size !== 4 || ids.some((id) => !state.raw.some((berry) => berry.id === id))) return null;
  return { ...state, raw: state.raw.filter((berry) => !selected.has(berry.id)), boxes: state.boxes + 1 };
}
