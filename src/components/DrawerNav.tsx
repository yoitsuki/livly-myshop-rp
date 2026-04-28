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
        className={`fixed top-0 right-0 z-50 h-dvh w-72 max-w-[80%] bg-white border-l border-[var(--color-line)] shadow-xl transition-transform duration-250 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--color-line)]">
          <div className="flex-1 leading-tight">
            <div className="text-[10px] text-muted tracking-[0.22em] uppercase font-medium">
              Livly · My-Shop
            </div>
            <div className="text-[15px] font-bold text-gold-deep">
              参考価格めも
            </div>
          </div>
          <button
            aria-label="メニューを閉じる"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[var(--color-line-soft)] text-text"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="py-2 flex-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 pl-4 pr-4 py-3 text-[14px] transition-colors relative ${
                  active
                    ? "text-gold-deep font-bold bg-[var(--color-line-soft)]"
                    : "text-text hover:bg-[var(--color-line-soft)]"
                }`}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-gold"
                  />
                )}
                <Icon
                  size={18}
                  strokeWidth={active ? 2.4 : 2}
                  className={active ? "text-gold-deep" : "text-muted"}
                />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-3 text-[10.5px] text-muted border-t border-[var(--color-line)] tabular-nums tracking-wide">
          ver. {APP_VERSION}
        </div>
      </aside>
    </>
  );
}
