"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Menu } from "lucide-react";

interface Props {
  onMenuClick: () => void;
  /** When true, shows a back button on the left instead of an empty slot. */
  back?: boolean;
}

export default function AppHeader({ onMenuClick, back }: Props) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 bg-white/95 backdrop-blur transition-shadow ${
        scrolled ? "shadow-[0_1px_0_var(--color-line)]" : ""
      }`}
    >
      <div className="max-w-screen-sm mx-auto px-3 h-12 flex items-center gap-2">
        {back ? (
          <button
            aria-label="戻る"
            onClick={() => router.back()}
            className="p-2 -ml-1 rounded-xl hover:bg-[var(--color-line-soft)] active:bg-[var(--color-line)] transition-colors text-text"
          >
            <ArrowLeft size={22} strokeWidth={2.2} />
          </button>
        ) : (
          <span className="w-9 h-9 -ml-1" aria-hidden />
        )}
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-[10px] text-muted tracking-[0.22em] font-medium uppercase">
            Livly · My-Shop
          </div>
          <h1 className="text-[16px] font-bold text-gold-deep tracking-wide truncate">
            参考価格めも
          </h1>
        </div>
        <button
          aria-label="メニューを開く"
          onClick={onMenuClick}
          className="p-2 -mr-1 rounded-xl hover:bg-[var(--color-line-soft)] active:bg-[var(--color-line)] transition-colors text-text"
        >
          <Menu size={22} strokeWidth={2.2} />
        </button>
      </div>
    </header>
  );
}
