export const cleanNickname = (name: string) => name.normalize("NFKC").trim().replace(/\s+/g, " ");
export function unusedNickname(preferred: string, taken: Set<string>) {
  const base = cleanNickname(preferred).slice(0, 16) || "산들바람";
  let candidate = base, number = 2;
  while (taken.has(candidate.toLowerCase())) {
    const suffix = ` ${number++}`; candidate = base.slice(0, 16 - suffix.length) + suffix;
  }
  return candidate;
}
export function sessionNicknames(players: { id: string; name: string }[]) {
  const used = new Set<string>(), names = new Map<string, string>();
  [...players].sort((a, b) => Number(a.id.startsWith("v2-")) - Number(b.id.startsWith("v2-")) || a.id.localeCompare(b.id)).forEach((player) => {
    const name = unusedNickname(player.name, used); used.add(name.toLowerCase()); names.set(player.id, name);
  });
  return names;
}
