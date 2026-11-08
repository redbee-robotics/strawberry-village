export type JeojatUser = { uid: string; nick: string };
export type Jeojat = {
  site: string;
  user: JeojatUser | null;
  ready: PromiseLike<unknown>;
  on: (event: "login" | "logout", listener: () => void) => unknown;
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<unknown>;
};

declare global {
  interface Window { jeojat?: Jeojat }
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
