import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const allowedActions = new Set(["walk", "water", "harvest", "sorting", "cafe", "sit", "lie"]);

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "origin" }, { status: 403, headers });
  if (!env.DB) return Response.json({ error: "unavailable" }, { status: 503, headers });
  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 1024) return Response.json({ error: "too_large" }, { status: 413, headers });
    body = JSON.parse(text);
    if (!body || typeof body !== "object") throw new Error("invalid");
  } catch { return Response.json({ error: "invalid" }, { status: 400, headers }); }
  const id = typeof body.id === "string" ? body.id : "";
  if (!/^[a-f0-9-]{36}$/.test(id)) return Response.json({ error: "invalid_id" }, { status: 400, headers });
  if (body.leave === true) { await env.DB.prepare("DELETE FROM farm_presence WHERE id = ?").bind(id).run(); return Response.json({ ok: true }, { headers }); }
  if (![body.x, body.z, body.angle, body.basket].every((n) => typeof n === "number" && Number.isFinite(n))) return Response.json({ error: "invalid_position" }, { status: 400, headers });
  const name = (typeof body.name === "string" ? body.name : "농부").replace(/[<>\u0000-\u001f]/g, "").slice(0, 16);
  const action = typeof body.action === "string" && allowedActions.has(body.action) ? body.action : "walk";
  const now = Date.now();
  const results = await env.DB.batch([
    env.DB.prepare("INSERT INTO farm_presence (id, name, x, z, angle, action, basket, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,x=excluded.x,z=excluded.z,angle=excluded.angle,action=excluded.action,basket=excluded.basket,updated_at=excluded.updated_at").bind(id, name, Math.max(-39, Math.min(39, Number(body.x))), Math.max(-34, Math.min(34, Number(body.z))), Number(body.angle) % (Math.PI * 2), action, Math.min(1000, Math.max(0, Math.floor(Number(body.basket)))), now),
    env.DB.prepare("DELETE FROM farm_presence WHERE updated_at < ?").bind(now - 30000),
    env.DB.prepare("SELECT id,name,x,z,angle,action,basket FROM farm_presence WHERE updated_at > ? AND id != ? ORDER BY updated_at DESC LIMIT 40").bind(now - 12000, id),
  ]);
  return Response.json({ players: results[2].results, total: results[2].results.length + 1 }, { headers });
}
