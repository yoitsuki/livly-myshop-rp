"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crop, Home, PlusCircle, Tag, Settings, X } from "lucide-react";
import { useEffect } from "react";
import { APP_VERSION } from "@/lib/version";

const items = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/register", label: "新規登録", icon: PlusCircle },
  { href: "/tags", label: "タグ管理", icon: Tag },
  { href: "/presets", label: "プリセット管理", icon: Crop },
  { href: "/settings", label: "設定", icon: Settings },
];

export default function DrawerNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-text/30 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        className={`fixed top-0 right-0 z-50 h-dvh w-72 max-w-[80%] bg-[var(--color-cream)] border-l border-[var(--color-line)] transition-transform duration-250 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {/* Header — matches AppHeader Atelier style */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3.5 border-b border-[var(--color-line)]">
          <div className="flex-1 leading-none flex flex-col gap-[3px]">
            <span
              className="text-[22px] font-normal leading-none tracking-[0.16em] text-[var(--color-gold-deep)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              LIVLY
            </span>
            <span
              className="text-[8.5px] font-medium leading-none tracking-[0.42em] text-[var(--color-muted)] uppercase"
              style={{ fontFamily: "var(--font-label)" }}
            >
              MY-SHOP REF
            </span>
          </div>
          <button
            aria-label="メニューを閉じる"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-[var(--color-text)] hover:bg-[var(--color-line-soft)] transition-colors"
          >
            <X size={20} strokeWidth={1.6} />
          </button>
        </div>

        <nav className="py-1 flex-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`relative flex items-center gap-3 pl-4 pr-4 py-3 text-[14px] transition-colors ${
                  active
                    ? "text-[var(--color-gold-deep)] font-bold bg-[var(--color-line-soft)]"
                    : "text-[var(--color-text)] hover:bg-[var(--color-line-soft)]"
                }`}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-2 bottom-2 w-[3px] bg-[var(--color-gold)]"
                  />
                )}
                <Icon
                  size={18}
                  strokeWidth={active ? 2.2 : 1.8}
                  className={active ? "text-[var(--color-gold-deep)]" : "text-[var(--color-muted)]"}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        <div
          className="px-4 py-3 text-[var(--color-muted)] border-t border-[var(--color-line)] tabular-nums"
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 10.5,
            letterSpacing: "0.04em",
          }}
        >
          ver. {APP_VERSION}
        </div>
      </aside>
    </>
  );
}
