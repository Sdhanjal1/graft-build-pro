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

import appCss from "../styles.css?url";
import { BottomNav } from "@/components/BottomNav";
import { Splash } from "@/components/Splash";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useSession } from "@/lib/auth";
import { hydrateUserData } from "@/lib/mock-data";

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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1a1a18" },
      { title: "Quottr — Quote in seconds. Get paid faster." },
      { name: "description", content: "AI-powered quoting and job management for UK tradespeople." },
      { property: "og:title", content: "Quottr — Quote in seconds. Get paid faster." },
      { name: "twitter:title", content: "Quottr — Quote in seconds. Get paid faster." },
      { property: "og:description", content: "AI-powered quoting and job management for UK tradespeople." },
      { name: "twitter:description", content: "AI-powered quoting and job management for UK tradespeople." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d15198a8-824e-4ab2-a3e4-78ab1c1d2dcd/id-preview-ff573e55--e4be6907-c837-4e5e-9461-63fadfdad91e.lovable.app-1779004697845.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d15198a8-824e-4ab2-a3e4-78ab1c1d2dcd/id-preview-ff573e55--e4be6907-c837-4e5e-9461-63fadfdad91e.lovable.app-1779004697845.png" },
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
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <Splash />
        <Outlet />
        <BottomNav />
        <PWAInstallBanner />
        <OfflineBanner />
      </AuthGate>
    </QueryClientProvider>
  );
}

const PUBLIC_ROUTES = new Set(["/auth", "/welcome", "/pricing", "/about"]);

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();
  const path = router.state.location.pathname;
  const isPublic = PUBLIC_ROUTES.has(path);

  React.useEffect(() => {
    if (loading) return;
    if (!session && !isPublic) {
      router.navigate({ to: "/auth" });
    } else if (session) {
      void hydrateUserData();
    }
  }, [session, loading, isPublic, router]);

  if (loading) return null;
  if (!session && !isPublic) return null;
  return <>{children}</>;
}
