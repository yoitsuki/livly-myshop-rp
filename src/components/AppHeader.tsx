"use client";

import { ArrowLeft, Menu, Upload } from "lucide-react";
import { GuardedLink } from "@/lib/unsavedChanges";

interface Props {
  /** Provided when an admin is signed in — clicking opens the DrawerNav. When
   *  omitted, the header swaps the right-slot to a viewer-style Upload icon
   *  pointing at /inbox so non-admin visitors keep the original viewer UX. */
  onMenuClick?: () => void;
  /** When true, shows a back button. */
  back?: boolean;
  /** Destination for the back button — falls back to "/" when omitted. */
  backHref?: string;
  /** Suppress the Upload icon (e.g. on the upload page itself). Has no effect
   *  when onMenuClick is provided (admin sees hamburger anyway). */
  hideUpload?: boolean;
}

export default function AppHeader({
  onMenuClick,
  back,
  backHref = "/",
  hideUpload,
}: Props) {
  return (
    <header className="sticky top-0 z-30 bg-[var(--color-cream)] border-b border-[var(--color-line)]">
      <div className="max-w-screen-sm mx-auto px-4 flex items-center gap-3 pt-4 pb-3.5">
        {back ? (
          <GuardedLink
            href={backHref}
            aria-label="戻る"
            className="-ml-1.5 w-8 h-8 flex items-center justify-center text-[var(--color-text)] hover:bg-[var(--color-line-soft)] transition-colors"
          >
            <ArrowLeft size={20} strokeWidth={1.6} />
          </GuardedLink>
        ) : null}

        <GuardedLink
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
        </GuardedLink>

        {onMenuClick ? (
          <button
            aria-label="メニューを開く"
            onClick={onMenuClick}
            className="-mr-1.5 w-8 h-8 flex items-center justify-center text-[var(--color-text)] hover:bg-[var(--color-line-soft)] transition-colors"
          >
            <Menu size={22} strokeWidth={1.4} />
          </button>
        ) : hideUpload ? null : (
          <GuardedLink
            href="/inbox"
            aria-label="管理者に画像を送る"
            className="-mr-1.5 -my-1 px-1.5 py-1 flex flex-col items-center gap-[3px] text-[var(--color-text)] hover:bg-[var(--color-line-soft)] transition-colors"
          >
            <Upload size={20} strokeWidth={1.6} />
            <span
              className="text-[8.5px] leading-none font-medium text-[var(--color-muted)]"
              style={{
                fontFamily: "var(--font-label)",
                letterSpacing: "0.08em",
              }}
            >
              アップロード
            </span>
          </GuardedLink>
        )}
      </div>
    </header>
  );
}
