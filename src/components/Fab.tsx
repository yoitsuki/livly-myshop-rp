"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/firebase/auth";

export default function Fab() {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Public visitors never see the registration FAB. Admin-only entry points
  // are gated at render time; Firebase rules still block any write that
  // somehow bypasses this UI guard.
  if (!isAdmin) return null;

  return (
    <div ref={wrapRef} className="fixed bottom-6 right-6 z-20">
      {open && (
        <div
          role="menu"
          aria-label="登録メニュー"
          className="absolute bottom-[60px] right-0 min-w-[160px] bg-[var(--color-cream)] border border-[var(--color-line-strong)]"
          style={{ borderRadius: 0 }}
        >
          <Link
            href="/register"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-[14px] text-[var(--color-text)] hover:bg-[var(--color-line-soft)] border-b border-[var(--color-line)]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            登録
          </Link>
          <Link
            href="/register/bulk"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-[14px] text-[var(--color-text)] hover:bg-[var(--color-line-soft)] border-b border-[var(--color-line)]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            まとめて登録
          </Link>
          <Link
            href="/register/inbox"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-[14px] text-[var(--color-text)] hover:bg-[var(--color-line-soft)]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            受信BOX
          </Link>
        </div>
      )}
      <button
        type="button"
        aria-label="新規登録"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-[52px] h-[52px] bg-[var(--color-gold-deep)] text-white
          hover:bg-gold active:scale-95 transition-colors duration-150 ease-out
          flex items-center justify-center"
        style={{ borderRadius: 0 }}
      >
        <Plus
          size={22}
          strokeWidth={2.2}
          className={`transition-transform duration-150 ${open ? "rotate-45" : ""}`}
        />
      </button>
    </div>
  );
}
