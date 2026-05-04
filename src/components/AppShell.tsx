"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import AppHeader from "./AppHeader";
import DrawerNav from "./DrawerNav";
import LoginScreen from "./LoginScreen";
import { useAuth } from "@/lib/firebase/auth";

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
  return null;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const { user, isAdmin, loading, redirectError } = useAuth();

  if (loading) {
    return <div className="min-h-dvh" aria-hidden />;
  }
  if (!user || !isAdmin) {
    return <LoginScreen user={user} redirectError={redirectError} />;
  }

  const backHref = parentHref(pathname);

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader
        onMenuClick={() => setOpen(true)}
        back={!!backHref}
        backHref={backHref ?? undefined}
      />
      <DrawerNav open={open} onClose={() => setOpen(false)} />
      <main className="flex-1 w-full max-w-screen-sm mx-auto px-4 pb-24 pt-2 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
