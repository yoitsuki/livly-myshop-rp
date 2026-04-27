"use client";

import { Menu } from "lucide-react";

export default function AppHeader({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-30 bg-cream/95 backdrop-blur border-b border-beige">
      <div className="max-w-screen-sm mx-auto px-3 py-2.5 flex items-center gap-3">
        <button
          aria-label="メニューを開く"
          onClick={onMenuClick}
          className="p-2 -ml-1 rounded-full hover:bg-beige/60 active:bg-beige transition-colors text-text"
        >
          <Menu size={24} strokeWidth={2.4} />
        </button>
        <div className="leading-tight">
          <div className="text-[13px] text-muted tracking-[0.18em]">
            リヴリー マイショップ
          </div>
          <h1 className="text-[20px] font-bold text-gold-deep tracking-wider">
            参考価格めも
          </h1>
        </div>
      </div>
    </header>
  );
}
