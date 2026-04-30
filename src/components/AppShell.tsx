"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import AppHeader from "./AppHeader";
import DrawerNav from "./DrawerNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";

  // Back button on item detail/edit pages.
  const back = pathname.startsWith("/items/");

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader onMenuClick={() => setOpen(true)} back={back} />
      <DrawerNav open={open} onClose={() => setOpen(false)} />
      <main className="flex-1 w-full max-w-screen-sm mx-auto px-4 pb-24 pt-2 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
