import { watchJeojatUser, type Jeojat, type JeojatUser } from "./jeojat";
import type { FarmWorld } from "./world";

const positionKey = "farmer-position-v1";
const ownerKey = "strawberry-position-owner-v1";
function savedAt(value: string) {
  try { const time = JSON.parse(value).updatedAt; return Number.isFinite(time) && time > 0 ? time : 0; } catch { return 0; }
}

export function connectJeojatFarmer(world: Pick<FarmWorld, "getSavedPosition" | "restoreSavedPosition">, onUser: (user: JeojatUser) => void) {
  let sdk: Jeojat | null = null, uid = "", generation = 0, disposed = false;
  let loaded = false, loading = false, sending = false, lastSaved = "", retryAfter = 0;
  let positionOwner = "";
  try { positionOwner = localStorage.getItem(ownerKey) || ""; } catch { /* The SDK also works without iframe storage. */ }

  async function save() {
    if (disposed || !sdk || sdk.user?.uid !== uid || !loaded || sending || Date.now() < retryAfter) return;
    const value = world.getSavedPosition(), current = generation;
    if (value === lastSaved) return;
    sending = true;
    try { await sdk.set(positionKey, value); if (current === generation) lastSaved = value; }
    catch { if (current === generation) retryAfter = Date.now() + 5000; }
    finally { if (current === generation) sending = false; }
  }

  async function load() {
    if (disposed || !sdk || sdk.user?.uid !== uid || loaded || loading || Date.now() < retryAfter) return;
    const before = world.getSavedPosition(), current = generation;
    loading = true;
    try {
      const value = await sdk.get(positionKey);
      if (disposed || current !== generation) return;
      const latest = world.getSavedPosition();
      // A slow account read must not move a farmer who has already started walking,
      // or replace a more recent offline save from this browser.
      if (typeof value === "string" && value.length <= 4096 && latest === before && (positionOwner !== uid || savedAt(value) >= savedAt(latest))) {
        if (world.restoreSavedPosition(value)) lastSaved = world.getSavedPosition();
      }
      positionOwner = uid;
      try { localStorage.setItem(ownerKey, uid); } catch { /* Keep the owner in memory when storage is blocked. */ }
      loaded = true;
      void save();
    } catch { if (current === generation) retryAfter = Date.now() + 5000; }
    finally { if (current === generation) loading = false; }
  }

  const reset = () => { generation++; sdk = null; uid = ""; loaded = loading = sending = false; lastSaved = ""; retryAfter = 0; };
  const stop = watchJeojatUser((user, api) => {
    onUser(user);
    if (uid === user.uid && sdk === api) return;
    reset();
    if (typeof api.get !== "function" || typeof api.set !== "function") return;
    sdk = api; uid = user.uid;
    void load();
  }, reset);
  const timer = window.setInterval(() => { if (loaded) void save(); else void load(); }, 1000);
  const hide = () => { void save(); };
  const visibility = () => { if (document.hidden) hide(); };
  window.addEventListener("pagehide", hide); document.addEventListener("visibilitychange", visibility);
  return () => {
    void save(); disposed = true; generation++; stop(); window.clearInterval(timer);
    window.removeEventListener("pagehide", hide); document.removeEventListener("visibilitychange", visibility);
  };
}
