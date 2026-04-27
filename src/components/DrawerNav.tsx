"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, Tag, X } from "lucide-react";
import { useEffect } from "react";
import { APP_VERSION } from "@/lib/version";

const items = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/register", label: "新規登録", icon: PlusCircle },
  { href: "/tags", label: "タグ管理", icon: Tag },
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
        className={`fixed top-0 left-0 z-50 h-dvh w-72 max-w-[80%] bg-cream border-r border-beige shadow-xl transition-transform duration-250 flex flex-col ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center gap-3 px-4 py-4 border-b border-beige">
          <div className="w-10 h-10 rounded-full bg-gold/90 text-white flex items-center justify-center font-bold">
            R
          </div>
          <div className="flex-1 leading-tight">
            <div className="text-[11px] text-muted tracking-widest">
              LIVLY MY-SHOP
            </div>
            <div className="text-[15px] font-bold text-text">参考価格めも</div>
          </div>
          <button
            aria-label="メニューを閉じる"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-beige/60 text-text"
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
                className={`flex items-center gap-3 px-4 py-3 text-[15px] transition-colors ${
                  active
                    ? "bg-beige text-gold-deep font-bold"
                    : "text-text hover:bg-beige/60"
                }`}
              >
                <Icon size={20} strokeWidth={2.2} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-3 text-[10.5px] text-muted border-t border-beige/70 tabular-nums">
          ver. {APP_VERSION}
        </div>
      </aside>
    </>
  );
}
