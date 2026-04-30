"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Menu } from "lucide-react";

interface Props {
  onMenuClick: () => void;
  /** When true, shows a back button and the detail sub-header rule. */
  back?: boolean;
  /** Label shown in the detail rule row (only when back=true). */
  detailLabel?: string;
}

export default function AppHeader({
  onMenuClick,
  back,
  detailLabel = "ITEM DETAIL",
}: Props) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 bg-[var(--color-cream)] border-b border-[var(--color-line)]">
      <div className="max-w-screen-sm mx-auto px-4 flex items-center gap-3 pt-4 pb-3.5">
        {back ? (
          <button
            aria-label="戻る"
            onClick={() => router.back()}
            className="-ml-1.5 w-8 h-8 flex items-center justify-center text-[var(--color-text)] hover:bg-[var(--color-line-soft)] transition-colors"
          >
            <ArrowLeft size={20} strokeWidth={1.6} />
          </button>
        ) : null}

        <Link
          href="/"
          aria-label="ホームに戻る"
          className="flex-1 min-w-0 flex flex-col gap-[3px] -my-1 py-1"
        >
          <span
            className="text-[22px] leading-none tracking-[0.16em] font-normal text-[var(--color-gold-deep)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            LIVLY
          </span>
          <span
            className="text-[8.5px] leading-none tracking-[0.42em] font-medium text-[var(--color-muted)] uppercase"
            style={{ fontFamily: "var(--font-label)" }}
          >
            MY-SHOP REF
          </span>
        </Link>

        <button
          aria-label="メニューを開く"
          onClick={onMenuClick}
          className="-mr-1.5 w-8 h-8 flex items-center justify-center text-[var(--color-text)] hover:bg-[var(--color-line-soft)] transition-colors"
        >
          <Menu size={22} strokeWidth={1.4} />
        </button>
      </div>

      {back && (
        <div className="max-w-screen-sm mx-auto px-[18px] pb-3.5 flex items-center gap-2.5">
          <span className="h-px flex-1 bg-[var(--color-line)]" aria-hidden />
          <span
            className="text-[9.5px] tracking-[0.34em] uppercase text-[var(--color-muted)]"
            style={{ fontFamily: "var(--font-label)" }}
          >
            {detailLabel}
          </span>
          <span className="h-px flex-1 bg-[var(--color-line)]" aria-hidden />
        </div>
      )}
    </header>
  );
}
