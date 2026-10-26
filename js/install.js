/* KlemmmosaikBase – Installation als App (Android/Chrome) */
(function () {
  "use strict";
  let deferred = null;
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => { try { fn(); } catch (e) {} });
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; notify(); });
  window.addEventListener("appinstalled", () => { deferred = null; notify(); });
  KM.install = {
    get standalone() { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; },
    get canPrompt() { return !!deferred; },
    onChange(fn) { listeners.add(fn); },
    async prompt() {
      if (!deferred) return "unavailable";
      const e = deferred; deferred = null;
      e.prompt();
      const r = await e.userChoice.catch(() => ({ outcome: "dismissed" }));
      notify();
      return r.outcome;
    }
  };
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
