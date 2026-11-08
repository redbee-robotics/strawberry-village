export const suggestedNicknames = ["햇살 한 줌", "느긋한 딸기", "초록빛 산책", "달콤한 바람", "이슬 맺힌 새싹", "작은 들꽃", "포근한 구름", "딸기향 오후", "산들바람", "아침 이슬", "싱그러운 잎새", "고요한 숲길", "반짝이는 열매", "초록 모자", "따뜻한 햇볕", "딸기 한 알", "풀잎 위 이슬", "가벼운 발걸음", "노을빛 마당", "반가운 봄비", "수줍은 새싹", "바람 속 들꽃", "열매 맺는 하루", "봄을 기다리는 씨앗"] as const;
export const cleanNickname = (name: string) => name.normalize("NFKC").trim().replace(/\s+/g, " ");
export function unusedNickname(preferred: string, taken: Set<string>) {
  const base = cleanNickname(preferred).slice(0, 16) || "산들바람";
  const available = (name: string) => !taken.has(name.toLowerCase());
  if (available(base)) return base;
  for (const name of suggestedNicknames) if (available(name)) return name;
  const places = ["아침", "노을", "숲길", "들녘", "마을", "햇살", "달빛", "별빛", "이슬", "바람", "구름", "산책길"];
  const moods = ["포근한", "싱그러운", "고요한", "반가운", "따뜻한", "느긋한", "수줍은", "달콤한", "작은", "빛나는", "푸른", "다정한"];
  const things = ["딸기", "새싹", "들꽃", "풀잎", "산들바람", "열매", "햇볕", "봄비", "씨앗", "나뭇잎", "구름", "산책", "꽃잎", "숲", "아침", "풍경"];
  for (const place of places) for (const mood of moods) for (const thing of things) {
    const name = `${place}의 ${mood} ${thing}`;
    if (available(name)) return name;
  }
  // Longer phrases keep the fallback readable even in a very crowded village.
  for (const place of places) for (const mood of moods) for (const first of things) for (const second of things) {
    const name = `${place}의 ${mood} ${first}와 ${second}`;
    if (name.length <= 16 && available(name)) return name;
  }
  throw new Error("사용할 수 있는 새 닉네임을 찾지 못했어요.");
}
export function nicknameChoice(requested: string, taken: Set<string>) {
  const name = cleanNickname(requested);
  if (!name || name.length > 16) return { ok: false as const, message: "닉네임은 1~16자로 입력해 주세요." };
  if (taken.has(name.toLowerCase())) {
    const suggestion = unusedNickname(name, taken);
    return { ok: false as const, message: `다른 방문자가 사용 중인 닉네임이에요. ‘${suggestion}’ 이름은 사용할 수 있어요.` };
  }
  return { ok: true as const, name };
}
export function sessionNicknames(players: { id: string; name: string }[]) {
  const used = new Set<string>(), names = new Map<string, string>();
  [...players].sort((a, b) => Number(a.id.startsWith("v2-")) - Number(b.id.startsWith("v2-")) || a.id.localeCompare(b.id)).forEach((player) => {
    const name = unusedNickname(player.name, used); used.add(name.toLowerCase()); names.set(player.id, name);
  });
  return names;
}
