import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RootErrorBoundary } from "./components/ErrorBoundary";

// Reload once if a dynamic chunk fails to load — usually a stale client
// pointing at a hash that no longer exists after a deploy.
if (typeof window !== "undefined") {
  const RELOAD_KEY = "quottr:chunk-reload";
  const isChunkError = (msg: string) =>
    /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk \d+ failed|ChunkLoadError/i.test(
      msg,
    );
  const tryReload = (msg: string) => {
    if (!isChunkError(msg)) return;
    try {
      if (sessionStorage.getItem(RELOAD_KEY)) return;
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {}
    window.location.reload();
  };
  window.addEventListener("error", (e) => tryReload(e.message || ""));
  window.addEventListener("unhandledrejection", (e) => {
    const msg =
      (e.reason && (e.reason.message || String(e.reason))) || "";
    tryReload(msg);
  });
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RootErrorBoundary,
  });

  return router;
};
