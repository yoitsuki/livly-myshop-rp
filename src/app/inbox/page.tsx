"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ImageIcon,
  ImagePlus,
  Loader2,
} from "lucide-react";
import { Button, Card, Toast } from "@/components/ui";
import { countPendingInboxFiles } from "@/lib/firebase/inbox";
import { uploadToInbox } from "@/lib/inboxUpload";

type ItemStatus = "queued" | "uploading" | "done" | "error";

interface UploadItem {
  id: string;
  fileName: string;
  size: number;
  status: ItemStatus;
  errorMessage?: string;
  previewUrl?: string;
}

const MAX_BYTES = 10 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Thumb({ src, alt }: { src?: string; alt: string }) {
  // HEIC etc. won't decode in <img> on most desktop browsers — fall back to an
  // icon via onError. We don't sniff types up front because Safari/iOS can in
  // fact render HEIC and we'd rather show the real preview when possible.
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  return (
    <div className="atelier-thumb shrink-0" style={{ width: 48, height: 48 }}>
      <div className="atelier-thumb-inner w-full h-full flex items-center justify-center text-[var(--color-muted)] bg-[var(--color-line-soft)]">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <ImageIcon size={18} strokeWidth={1.4} aria-hidden />
        )}
      </div>
      <span className="atelier-tick atelier-tick--tl" aria-hidden />
      <span className="atelier-tick atelier-tick--tr" aria-hidden />
      <span className="atelier-tick atelier-tick--bl" aria-hidden />
      <span className="atelier-tick atelier-tick--br" aria-hidden />
    </div>
  );
}

function StatusBadge({
  status,
  errorMessage,
}: {
  status: ItemStatus;
  errorMessage?: string;
}) {
  const baseStyle: React.CSSProperties = {
    fontFamily: "var(--font-label)",
    fontSize: 11,
    letterSpacing: "0.06em",
  };
  if (status === "queued" || status === "uploading") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[var(--color-muted)] tabular-nums"
        style={baseStyle}
      >
        <Loader2 size={13} strokeWidth={1.8} className="animate-spin" aria-hidden />
        送信中
      </span>
    );
  }
  if (status === "done") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[var(--color-gold-deep)] tabular-nums"
        style={baseStyle}
      >
        <CheckCircle2 size={13} strokeWidth={1.8} aria-hidden />
        送信済み
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-[var(--color-danger)] tabular-nums"
      style={baseStyle}
      title={errorMessage}
    >
      <AlertTriangle size={13} strokeWidth={1.8} aria-hidden />
      失敗{errorMessage ? ` — ${errorMessage}` : ""}
    </span>
  );
}

export default function InboxUploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [pendingCount, setPendingCount] = useState<
    { kind: "loading" } | { kind: "error" } | { kind: "loaded"; n: number }
  >({ kind: "loading" });
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    tone: "success" | "info" | "warn";
  }>({ open: false, message: "", tone: "success" });

  const refreshPendingCount = useCallback(async () => {
    setPendingCount({ kind: "loading" });
    try {
      const n = await countPendingInboxFiles();
      setPendingCount({ kind: "loaded", n });
    } catch {
      setPendingCount({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  const showToast = useCallback(
    (message: string, tone: "success" | "info" | "warn") => {
      setToast({ open: true, message, tone });
    },
    [],
  );

  useEffect(() => {
    if (!toast.open) return;
    const id = window.setTimeout(
      () => setToast((t) => ({ ...t, open: false })),
      3500,
    );
    return () => window.clearTimeout(id);
  }, [toast.open, toast.message]);

  // Track every preview URL we minted in a ref so we can revoke them when the
  // page unmounts (createObjectURL leaks otherwise).
  const previewUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      previewUrlsRef.current = [];
    };
  }, []);

  // Block accidental navigation while any upload is mid-flight so the queued
  // PUTs aren't fire-and-forget against an unmounting page.
  const inFlight = items.some(
    (i) => i.status === "uploading" || i.status === "queued",
  );
  useEffect(() => {
    if (!inFlight) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [inFlight]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (!navigator.onLine) {
        showToast("オフラインです。接続後に再度お試しください。", "warn");
        return;
      }

      const arr = Array.from(files);
      const prepared = arr.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.push(previewUrl);
        return {
          id: crypto.randomUUID(),
          file,
          tooBig: file.size > MAX_BYTES,
          previewUrl,
        };
      });
      const newItems: UploadItem[] = prepared.map(
        ({ id, file, tooBig, previewUrl }) => ({
          id,
          fileName: file.name,
          size: file.size,
          status: tooBig ? "error" : "queued",
          errorMessage: tooBig ? "サイズが大きすぎます (>10MB)" : undefined,
          previewUrl,
        }),
      );
      setItems((prev) => [...newItems, ...prev]);

      const toUpload = prepared.filter((p) => !p.tooBig);
      if (toUpload.length === 0) {
        showToast("サイズ超過のため送信しませんでした", "warn");
        return;
      }

      const uploadIds = new Set(toUpload.map((u) => u.id));
      setItems((prev) =>
        prev.map((it) =>
          uploadIds.has(it.id) ? { ...it, status: "uploading" } : it,
        ),
      );

      const results = await Promise.all(
        toUpload.map(async ({ id, file }) => {
          try {
            await uploadToInbox(file);
            return { id, ok: true as const };
          } catch (e) {
            const code = (e as { code?: string })?.code;
            const message =
              code ?? (e instanceof Error ? e.message : "unknown");
            return { id, ok: false as const, message };
          }
        }),
      );

      const resultMap = new Map(results.map((r) => [r.id, r]));
      setItems((prev) =>
        prev.map((it) => {
          const r = resultMap.get(it.id);
          if (!r) return it;
          if (r.ok) return { ...it, status: "done" as const };
          return { ...it, status: "error" as const, errorMessage: r.message };
        }),
      );

      const successCount = results.filter((r) => r.ok).length;
      const failCount = results.length - successCount;
      if (failCount === 0) {
        showToast(`${successCount} 件送信しました`, "success");
      } else if (successCount === 0) {
        showToast(`送信に失敗しました (${failCount} 件)`, "warn");
      } else {
        showToast(`${successCount} 件送信、${failCount} 件失敗`, "warn");
      }

      if (successCount > 0) {
        refreshPendingCount();
      }
    },
    [showToast, refreshPendingCount],
  );

  return (
    <div className="space-y-4 pt-3">
      <header className="space-y-1.5">
        <h1
          className="text-[18px] text-[var(--color-text)]"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}
        >
          管理者に画像を送る
        </h1>
        <p
          className="text-[12px] text-[var(--color-text)]"
          style={{ fontFamily: "var(--font-label)", letterSpacing: "0.04em" }}
        >
          管理者に画像を送ると確認後に登録されます。
        </p>
        <p
          className="text-[12px] text-[var(--color-muted)]"
          style={{ fontFamily: "var(--font-label)", letterSpacing: "0.04em" }}
        >
          JPEG / PNG / WebP / HEIC 対応 (HEIC は自動で JPEG に変換)。1 枚あたり 10 MB まで。
        </p>
      </header>

      <Card padding="md" className="space-y-3">
        <Button
          type="button"
          variant="primary"
          size="md"
          fullWidth
          icon={<ImagePlus size={16} strokeWidth={1.8} aria-hidden />}
          onClick={() => inputRef.current?.click()}
        >
          画像を選んで送信
        </Button>
        <p
          className="text-[11px] text-[var(--color-muted)]"
          style={{ fontFamily: "var(--font-label)", letterSpacing: "0.04em" }}
        >
          複数枚まとめて選択できます。選択後すぐに送信が始まります。
        </p>
        <p
          className="text-[11px] text-[var(--color-muted)] tabular-nums inline-flex items-center gap-1"
          style={{ fontFamily: "var(--font-label)", letterSpacing: "0.04em" }}
        >
          {pendingCount.kind === "loading" ? (
            <>
              <Loader2 size={12} strokeWidth={1.8} className="animate-spin" aria-hidden />
              登録待ち件数: 読み込み中…
            </>
          ) : pendingCount.kind === "error" ? (
            <>登録待ち件数: 取得に失敗しました</>
          ) : (
            <>登録待ち件数: {pendingCount.n} 件</>
          )}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            // Reset so the same file can be re-selected after a failure.
            e.target.value = "";
          }}
        />
      </Card>

      {items.length > 0 ? (
        <ul className="divide-y divide-[var(--color-line)] border border-[var(--color-line)] bg-white">
          {items.map((it) => (
            <li key={it.id} className="px-3 py-2.5 flex items-center gap-3">
              <Thumb src={it.previewUrl} alt={it.fileName} />
              <div className="min-w-0 flex-1">
                <div
                  className="text-[13px] text-[var(--color-text)] truncate"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {it.fileName}
                </div>
                <div
                  className="text-[10.5px] text-[var(--color-muted)] tabular-nums"
                  style={{
                    fontFamily: "var(--font-label)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {formatSize(it.size)}
                </div>
              </div>
              <StatusBadge status={it.status} errorMessage={it.errorMessage} />
            </li>
          ))}
        </ul>
      ) : null}

      <Toast open={toast.open} message={toast.message} tone={toast.tone} />
    </div>
  );
}
