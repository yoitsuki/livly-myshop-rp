"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Menu, Settings } from "lucide-react";

interface Props {
  onMenuClick: () => void;
  /** When true, shows a back button on the left instead of an empty slot. */
  back?: boolean;
  /** When true, hides the settings cog (e.g. on the settings page itself). */
  hideSettings?: boolean;
}

export default function AppHeader({ onMenuClick, back, hideSettings }: Props) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 bg-cream/95 backdrop-blur border-b border-beige">
      <div className="max-w-screen-sm mx-auto px-3 py-2.5 flex items-center gap-3">
        {back ? (
          <button
            aria-label="戻る"
            onClick={() => router.back()}
            className="p-2 -ml-1 rounded-full hover:bg-beige/60 active:bg-beige transition-colors text-text"
          >
            <ArrowLeft size={24} strokeWidth={2.4} />
          </button>
        ) : (
          // empty slot to keep the title flush left whether or not back is shown
          <span className="w-9 h-9 -ml-1" aria-hidden />
        )}
        <div className="leading-tight flex-1 min-w-0">
          <div className="text-[13px] text-muted tracking-[0.18em]">
            リヴリー マイショップ
          </div>
          <h1 className="text-[20px] font-bold text-gold-deep tracking-wider truncate">
            参考価格めも
          </h1>
        </div>
        {!hideSettings && (
          <Link
            href="/settings"
            aria-label="設定"
            className="p-2 rounded-full hover:bg-beige/60 active:bg-beige transition-colors text-text/80"
          >
            <Settings size={20} strokeWidth={2.2} />
          </Link>
        )}
        <button
          aria-label="メニューを開く"
          onClick={onMenuClick}
          className="p-2 -mr-1 rounded-full hover:bg-beige/60 active:bg-beige transition-colors text-text"
        >
          <Menu size={24} strokeWidth={2.4} />
        </button>
      </div>
    </header>
  );
}
