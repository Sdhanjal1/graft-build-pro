declare const __APP_VERSION__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

export const SW_UPDATE_EVENT = "quottr:sw-update-ready";

function shouldSkip(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return true;
  if (!("serviceWorker" in navigator)) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.includes("id-preview--") || host.includes("lovableproject.com")) return true;
  return false;
}

function emitUpdateReady(reg: ServiceWorkerRegistration) {
  const waiting = reg.waiting;
  if (!waiting) return;
  window.dispatchEvent(
    new CustomEvent(SW_UPDATE_EVENT, { detail: { waiting, registration: reg } }),
  );
}

let registered = false;

export function registerServiceWorker() {
  if (registered) return;
  if (shouldSkip()) return;
  registered = true;

  const swUrl = `/sw.js?v=${encodeURIComponent(APP_VERSION)}`;

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .register(swUrl, { updateViaCache: "none", scope: "/" })
    .then((reg) => {
      // Already-waiting worker from a previous session.
      if (reg.waiting && navigator.serviceWorker.controller) {
        emitUpdateReady(reg);
      }

      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (
            installing.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            emitUpdateReady(reg);
          }
        });
      });

      const checkUpdate = () => {
        if (document.visibilityState === "visible") {
          reg.update().catch(() => {});
        }
      };
      document.addEventListener("visibilitychange", checkUpdate);
      window.addEventListener("focus", checkUpdate);
    })
    .catch((err) => {
      console.warn("[sw] registration failed", err);
    });
}
