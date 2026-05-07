"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import AppHeader from "./AppHeader";
import DrawerNav from "./DrawerNav";
import LoginScreen from "./LoginScreen";
import { useAuth } from "@/lib/firebase/auth";
import { UnsavedChangesProvider } from "@/lib/unsavedChanges";

/**
 * Resolves the "parent" path for the back button. We avoid router.back()
 * because router.push from save handlers builds up an unpredictable history
 * stack — a single back-tap could land on an old edit screen instead of the
 * detail page. Instead we navigate explicitly to a known parent.
 */
function parentHref(pathname: string): string | null {
  const itemMatch = pathname.match(/^\/items\/([^/]+)(\/.*)?$/);
  if (itemMatch) {
    const [, itemId, rest] = itemMatch;
    if (!rest) return "/"; // detail page → home
    return `/items/${itemId}`; // edit / prices/* → detail
  }
  if (pathname === "/inbox" || pathname.startsWith("/inbox/")) return "/";
  return null;
}

/**
 * Public routes are reachable without admin sign-in: home, item detail
 * (read-only display), and the viewer-style /inbox upload page. Admin-only
 * paths like /items/[id]/edit, /items/[id]/prices/*, /register*, /tags,
 * /presets, /settings fall through and trigger the LoginScreen for
 * non-admin visitors who URL-direct into them.
 */
function isPublicRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    /^\/items\/[^/]+\/?$/.test(pathname) ||
    pathname === "/inbox" ||
    pathname.startsWith("/inbox/")
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const { user, isAdmin, loading, redirectError } = useAuth();

  if (loading) {
    return <div className="min-h-dvh" aria-hidden />;
  }

  // Admin-route hit by a non-admin visitor → LoginScreen. URL-direct entry
  // to /register etc. is the only login surface; public pages never expose
  // a login button.
  if (!isPublicRoute(pathname) && !isAdmin) {
    return <LoginScreen user={user} redirectError={redirectError} />;
  }

  const backHref = parentHref(pathname);
  const onInbox = pathname === "/inbox" || pathname.startsWith("/inbox/");

  return (
    <div className="min-h-dvh flex flex-col">
      <UnsavedChangesProvider>
        <AppHeader
          onMenuClick={isAdmin ? () => setOpen(true) : undefined}
          back={!!backHref}
          backHref={backHref ?? undefined}
          hideUpload={onInbox}
        />
        {isAdmin && <DrawerNav open={open} onClose={() => setOpen(false)} />}
        <main className="flex-1 w-full max-w-screen-sm mx-auto px-4 pb-24 pt-2 overflow-x-hidden">
          {children}
        </main>
      </UnsavedChangesProvider>
    </div>
  );
}
