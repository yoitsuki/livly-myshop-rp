"use client";

import { useState } from "react";
import AppHeader from "./AppHeader";
import DrawerNav from "./DrawerNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader onMenuClick={() => setOpen(true)} />
      <DrawerNav open={open} onClose={() => setOpen(false)} />
      <main className="flex-1 w-full max-w-screen-sm mx-auto px-4 pb-24 pt-2">
        {children}
      </main>
    </div>
  );
}
