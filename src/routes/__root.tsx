import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";

import appCss from "../styles.css?url";
import { BottomNav } from "@/components/BottomNav";

import { Splash } from "@/components/Splash";
import { BannerSlot } from "@/components/BannerSlot";
import { useSession } from "@/lib/auth";
import { hydrateUserData, clearUserData } from "@/lib/user-data";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page not found.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex items-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
      { name: "theme-color", content: "#1a1a18" },
      { title: "Quottr: quote in seconds, get paid faster" },
      { name: "description", content: "AI-powered quoting and job management for UK tradespeople." },
      { property: "og:title", content: "Quottr: quote in seconds, get paid faster" },
      { name: "twitter:title", content: "Quottr: quote in seconds, get paid faster" },
      { property: "og:description", content: "AI-powered quoting and job management for UK tradespeople." },
      { name: "twitter:description", content: "AI-powered quoting and job management for UK tradespeople." },
      { property: "og:image", content: "https://quottr.co.uk/og-quottr.jpg" },
      { name: "twitter:image", content: "https://quottr.co.uk/og-quottr.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Quottr." },
      { name: "application-name", content: "Quottr." },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/app-icon.png" },
      { rel: "apple-touch-icon", href: "/app-icon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/app-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ backgroundColor: "#f5f2ec" }}>
      <head>
        <HeadContent />
      </head>
      <body style={{ backgroundColor: "#f5f2ec" }}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const path = router.state.location.pathname;
  const MARKETING_PATHS = new Set(["/", "/welcome", "/pricing", "/about", "/features", "/faqs", "/trades"]);
  const isMarketing = MARKETING_PATHS.has(path);
  const isAuth = path === "/auth";
  const isPortal = path.startsWith("/portal/") || path.startsWith("/request/");
  const showAppChrome = !isMarketing && !isAuth && !isPortal;
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={path}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
        {showAppChrome && <BottomNav />}

        {!isPortal && <BannerSlot />}
      </AuthGate>
    </QueryClientProvider>
  );
}

const PUBLIC_ROUTES = new Set(["/", "/auth", "/welcome", "/pricing", "/about", "/features", "/faqs", "/trades"]);

function isPublicPath(path: string) {
  return PUBLIC_ROUTES.has(path) || path.startsWith("/portal/") || path.startsWith("/request/");
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();
  const path = router.state.location.pathname;
  const isPublic = isPublicPath(path);

  React.useEffect(() => {
    if (loading) return;
    if (!session && !isPublic) {
      router.navigate({ to: "/auth" });
    } else if (session) {
      void hydrateUserData();
    } else {
      // Signed out, clear cached user data so it doesn't bleed into the next session.
      clearUserData();
    }
  }, [session, loading, isPublic, router]);

  if (loading) return null;
  if (!session && !isPublic) return null;
  return <>{children}</>;
}

