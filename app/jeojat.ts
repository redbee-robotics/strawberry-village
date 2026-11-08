export type JeojatUser = { uid: string; nick: string };
export type Jeojat = {
  site: string;
  user: JeojatUser | null;
  ready: PromiseLike<unknown>;
  login: () => Promise<JeojatUser>;
  on: (event: "login" | "logout", listener: () => void) => unknown;
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<unknown>;
};

declare global {
  interface Window { jeojat?: Jeojat }
}

let cancelFrameEntry: (() => void) | undefined;

// embed.js sends its first hello only once. If the parent module is still
// loading, that message is lost. Give it one more chance after SDK readiness.
// The parent owns consent and the SDK owns tokens; never open a login popup here.
export function prepareJeojatFrameEntry() {
  cancelFrameEntry?.();
  if (window.self === window.top) return () => {};
  let active = true;
  let subscribed: Jeojat | undefined;
  let timer: number | undefined;
  const stop = () => {
    active = false;
    window.clearTimeout(timer);
    window.removeEventListener("jeojat:ready", bind);
    window.removeEventListener("pagehide", stop);
    if (cancelFrameEntry === stop) cancelFrameEntry = undefined;
  };
  const bind = () => {
    const sdk = window.jeojat;
    if (!active || !sdk || sdk.site !== "pYUoDazk7y" || subscribed === sdk) return;
    subscribed = sdk;
    window.clearTimeout(timer);
    const end = () => { if (subscribed === sdk) stop(); };
    sdk.on("login", end);
    sdk.on("logout", end);
    void Promise.resolve(sdk.ready).then(() => {
      if (!active || subscribed !== sdk) return;
      if (sdk.user) { stop(); return; }
      // No acknowledgement is sent for a consent offer. Retry only once,
      // rather than polling and repeatedly reopening a dismissed offer.
      timer = window.setTimeout(() => {
        if (active && window.jeojat === sdk && !sdk.user) {
          window.parent.postMessage({ type: "jeojat:hello", site: sdk.site }, "https://jeojat.altolab.ai");
        }
        stop();
      }, 3000);
    }, () => { if (subscribed === sdk) stop(); });
  };
  cancelFrameEntry = stop;
  window.addEventListener("jeojat:ready", bind);
  window.addEventListener("pagehide", stop);
  bind();
  return stop;
}

// Call directly from the click handler so standalone visits can open the
// official login popup while the browser's user gesture is still active.
export function loginWithJeojat() {
  const sdk = window.jeojat;
  if (!sdk || sdk.site !== "pYUoDazk7y" || typeof sdk.login !== "function") throw new Error("Jeojat is not ready");
  cancelFrameEntry?.();
  return sdk.login();
}

// embed.js validates its parent/popup messages and owns the login token.
// Subscribe to its public API, including an embed that loads after the app.
export function watchJeojatUser(onUser: (user: JeojatUser, sdk: Jeojat) => void, onLogout: () => void = () => {}) {
  let active = true;
  let subscribed: Jeojat | undefined;
  let lastUser = "";
  const bind = () => {
    const sdk = window.jeojat;
    if (!sdk || sdk.site !== "pYUoDazk7y" || sdk === subscribed) return;
    subscribed = sdk;
    const update = () => {
      if (!active || subscribed !== sdk) return;
      const user = sdk.user;
      if (!user) { lastUser = ""; onLogout(); return; }
      if (typeof user.uid !== "string" || !user.uid || typeof user.nick !== "string" || !user.nick.trim() || user.nick.length > 16) return;
      const key = JSON.stringify([user.uid, user.nick]);
      if (key === lastUser) return;
      lastUser = key;
      onUser({ uid: user.uid, nick: user.nick }, sdk);
    };
    sdk.on("login", update);
    sdk.on("logout", update);
    void Promise.resolve(sdk.ready).then(update, () => {});
  };
  window.addEventListener("jeojat:ready", bind);
  bind();
  return () => { active = false; window.removeEventListener("jeojat:ready", bind); };
}
