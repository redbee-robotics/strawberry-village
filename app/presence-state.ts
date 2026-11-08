import type { RemotePlayer } from "./world";

const productionHosts = new Set(["strawberry-village.web.app", "strawberry-village.firebaseapp.com"]);
export const presenceLifetime = 30000;

// Local servers, built previews and temporary hosting URLs all use the development village.
export function villagePlayersPath(hostname: string) {
  const environment = productionHosts.has(hostname) ? "production" : "development";
  return `village/environments/${environment}/players`;
}

export type VillagePlayers = Record<string, Record<string, RemotePlayer & { updatedAt: number }>>;

export function activeVillagePlayers(latest: VillagePlayers, now: number): RemotePlayer[] {
  return Object.values(latest).flatMap((sessions) => Object.values(sessions || {})).filter((player) =>
    player && [player.updatedAt, player.x, player.z, player.angle].every(Number.isFinite)
    && player.updatedAt <= now + 1000 && now - player.updatedAt < presenceLifetime,
  );
}
