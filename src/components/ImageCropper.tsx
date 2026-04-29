"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { cropAndEncode, getImageSize, type CropRect } from "@/lib/image";

export interface CropperResult {
  blob: Blob;
  rect: CropRect;
  source: { width: number; height: number };
}

interface Props {
  source: Blob | null;
  open: boolean;
  title: string;
  /** Width cap on the encoded output. */
  maxOutputWidth?: number;
  /** Force a fixed aspect ratio (w/h). Omit for free-form. */
  aspect?: number;
  /** Initial crop rectangle. If omitted, defaults to a centered region. */
  initialRect?: CropRect;
  /**
   * When true (and no initialRect is provided), the default rectangle covers
   * the entire source image instead of a centered, margin-padded box. Useful
   * for "fine-adjust an already-cropped image" flows.
   */
  fillExtent?: boolean;
  onCancel: () => void;
  onConfirm: (result: CropperResult) => void;
}

// Match the bundled card_uploader sample: only mid-edge handles (n/e/s/w).
const HANDLES: Array<{
  key: "n" | "e" | "s" | "w";
  cursor: string;
  pos: string;
}> = [
  { key: "n", cursor: "ns-resize", pos: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" },
  { key: "e", cursor: "ew-resize", pos: "top-1/2 right-0 translate-x-1/2 -translate-y-1/2" },
  { key: "s", cursor: "ns-resize", pos: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" },
  { key: "w", cursor: "ew-resize", pos: "top-1/2 left-0 -translate-x-1/2 -translate-y-1/2" },
];

const MIN_SIZE = 24;

export default function ImageCropper({
  source,
  open,
  title,
  maxOutputWidth,
  aspect,
  initialRect,
  fillExtent,
  onCancel,
  onConfirm,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragStartRef = useRef<
    | {
        handle: string;
        startPoint: { x: number; y: number };
        startRect: CropRect;
      }
    | null
  >(null);

  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [imgSize, setImgSize] = useState<{ width: number; height: number } | null>(null);
  const [rect, setRect] = useState<CropRect | null>(null);
  const [busy, setBusy] = useState(false);

  // Manage object URL for the preview image
  useEffect(() => {
    if (!source) {
      setPreviewUrl(undefined);
      setImgSize(null);
      setRect(null);
      return;
    }
    const url = URL.createObjectURL(source);
    setPreviewUrl(url);
    getImageSize(source).then((size) => {
      setImgSize(size);
      const init = initialRect
        ? clampRect(initialRect, size)
        : fillExtent
          ? { x: 0, y: 0, w: size.width, h: size.height }
          : defaultRect(size, aspect);
      setRect(init);
    });
    return () => URL.revokeObjectURL(url);
  }, [source, aspect, initialRect, fillExtent]);

  // Drag handlers
  useEffect(() => {
    if (!open || !rect || !imgSize) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const getPoint = (ev: MouseEvent | TouchEvent) => {
      if ("touches" in ev && ev.touches.length > 0) {
        return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
      }
      if ("changedTouches" in ev && ev.changedTouches.length > 0) {
        return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
      }
      const me = ev as MouseEvent;
      return { x: me.clientX, y: me.clientY };
    };

    const toImagePixels = (clientX: number, clientY: number) => {
      const img = imgRef.current;
      if (!img) return { x: 0, y: 0 };
      const r = img.getBoundingClientRect();
      const sx = imgSize.width / r.width;
      const sy = imgSize.height / r.height;
      return {
        x: Math.max(0, Math.min(imgSize.width, (clientX - r.left) * sx)),
        y: Math.max(0, Math.min(imgSize.height, (clientY - r.top) * sy)),
      };
    };

    const onDown = (ev: MouseEvent | TouchEvent) => {
      const target = ev.target as HTMLElement | null;
      const handle = target?.dataset?.handle;
      if (!handle) return;
      if (ev.cancelable) ev.preventDefault();
      const p = getPoint(ev);
      const start = toImagePixels(p.x, p.y);
      dragStartRef.current = {
        handle,
        startPoint: start,
        startRect: { ...rectRef.current! },
      };
    };

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const ds = dragStartRef.current;
      if (!ds) return;
      if (ev.cancelable) ev.preventDefault();
      const p = getPoint(ev);
      const cur = toImagePixels(p.x, p.y);
      const dx = cur.x - ds.startPoint.x;
      const dy = cur.y - ds.startPoint.y;
      let { x: x1, y: y1 } = ds.startRect;
      let x2 = x1 + ds.startRect.w;
      let y2 = y1 + ds.startRect.h;
      const W = imgSize.width;
      const H = imgSize.height;
      const h = ds.handle;
      if (h === "move") {
        let nx1 = x1 + dx;
        let nx2 = x2 + dx;
        let ny1 = y1 + dy;
        let ny2 = y2 + dy;
        if (nx1 < 0) {
          nx2 -= nx1;
          nx1 = 0;
        }
        if (nx2 > W) {
          nx1 -= nx2 - W;
          nx2 = W;
        }
        if (ny1 < 0) {
          ny2 -= ny1;
          ny1 = 0;
        }
        if (ny2 > H) {
          ny1 -= ny2 - H;
          ny2 = H;
        }
        x1 = nx1;
        x2 = nx2;
        y1 = ny1;
        y2 = ny2;
      } else {
        if (h.includes("w")) x1 = Math.max(0, Math.min(x2 - MIN_SIZE, x1 + dx));
        if (h.includes("e")) x2 = Math.min(W, Math.max(x1 + MIN_SIZE, x2 + dx));
        if (h.includes("n")) y1 = Math.max(0, Math.min(y2 - MIN_SIZE, y1 + dy));
        if (h.includes("s")) y2 = Math.min(H, Math.max(y1 + MIN_SIZE, y2 + dy));
      }
      let next: CropRect = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      if (aspect && h !== "move") {
        next = enforceAspect(next, ds.startRect, aspect, h, W, H);
      }
      setRect(next);
    };

    const onUp = () => {
      dragStartRef.current = null;
    };

    const opts = { passive: false };
    wrapper.addEventListener("mousedown", onDown, opts);
    window.addEventListener("mousemove", onMove, opts);
    window.addEventListener("mouseup", onUp);
    wrapper.addEventListener("touchstart", onDown, opts);
    window.addEventListener("touchmove", onMove, opts);
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchcancel", onUp);
    return () => {
      wrapper.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      wrapper.removeEventListener("touchstart", onDown);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onUp);
    };
  }, [open, imgSize, aspect, rect]);

  // Mirror rect in a ref so handlers see the latest value without re-binding
  const rectRef = useRef<CropRect | null>(null);
  useEffect(() => {
    rectRef.current = rect;
  }, [rect]);

  if (!open || !source) return null;

  const dispRect =
    rect && imgSize && imgRef.current
      ? (() => {
          const r = imgRef.current!.getBoundingClientRect();
          const wrap = wrapperRef.current?.getBoundingClientRect();
          if (!wrap) return null;
          const offX = r.left - wrap.left;
          const offY = r.top - wrap.top;
          const sx = r.width / imgSize.width;
          const sy = r.height / imgSize.height;
          return {
            left: offX + rect.x * sx,
            top: offY + rect.y * sy,
            width: rect.w * sx,
            height: rect.h * sy,
          };
        })()
      : null;

  const onConfirmClick = async () => {
    if (!source || !rect || !imgSize) return;
    setBusy(true);
    try {
      const blob = await cropAndEncode(source, rect, {
        maxWidth: maxOutputWidth,
        quality: 0.85,
      });
      onConfirm({ blob, rect, source: imgSize });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      role="dialog"
      style={{ background: "rgba(20, 40, 38, 0.92)" }}
    >
      <div className="flex items-center justify-between px-3 h-12 text-white border-b border-white/10">
        <button
          onClick={onCancel}
          aria-label="キャンセル"
          className="p-2 -ml-1 hover:bg-white/10 transition-colors"
        >
          <X size={22} strokeWidth={1.8} />
        </button>
        <div className="text-[13px] font-bold tracking-wide">{title}</div>
        <button
          onClick={onConfirmClick}
          disabled={busy || !rect}
          aria-label="決定"
          className="p-2 -mr-1 hover:bg-white/10 disabled:opacity-50 transition-colors"
        >
          <Check size={22} strokeWidth={1.8} />
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center p-3">
        <div
          ref={wrapperRef}
          className="relative inline-block touch-none select-none max-w-full max-h-full"
          style={{ lineHeight: 0 }}
        >
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={previewUrl}
              alt="切り抜き対象"
              className="max-w-full max-h-[70vh] object-contain block"
              draggable={false}
              onLoad={(e) => {
                // Trigger a re-render so dispRect can use bounding box
                const el = e.currentTarget;
                if (imgSize == null) return;
                el.style.opacity = "1";
              }}
            />
          )}
          {dispRect && (
            <>
              {/* dim outside */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow: `0 0 0 9999px rgba(20, 40, 38, 0.72)`,
                  clipPath: `polygon(
                    0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                    ${dispRect.left}px ${dispRect.top}px,
                    ${dispRect.left}px ${dispRect.top + dispRect.height}px,
                    ${dispRect.left + dispRect.width}px ${dispRect.top + dispRect.height}px,
                    ${dispRect.left + dispRect.width}px ${dispRect.top}px,
                    ${dispRect.left}px ${dispRect.top}px
                  )`,
                }}
              />
              {/* selection rect — dark teal stroke + light interior handles */}
              <div
                data-handle="move"
                className="absolute cursor-move"
                style={{
                  left: dispRect.left,
                  top: dispRect.top,
                  width: dispRect.width,
                  height: dispRect.height,
                  pointerEvents: "auto",
                  boxShadow: "inset 0 0 0 2px #3f7b72",
                }}
              >
                {/* grid lines */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute left-1/3 top-0 bottom-0 border-l border-gold-deep/50" />
                  <div className="absolute left-2/3 top-0 bottom-0 border-l border-gold-deep/50" />
                  <div className="absolute top-1/3 left-0 right-0 border-t border-gold-deep/50" />
                  <div className="absolute top-2/3 left-0 right-0 border-t border-gold-deep/50" />
                </div>
                {HANDLES.map((h) => (
                  <span
                    key={h.key}
                    data-handle={h.key}
                    className={`absolute w-4 h-4 bg-white border-2 border-gold-deep ${h.pos}`}
                    style={{ cursor: h.cursor }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="px-4 py-3 text-white/80 text-[12px] text-center space-y-1 border-t border-white/10">
        <div>枠の辺・中央をドラッグして切り抜き範囲を調整してください。</div>
        {rect && imgSize && (
          <div className="font-mono text-[11px] text-white/65 tabular-nums">
            x={Math.round(rect.x)}, y={Math.round(rect.y)}, w=
            {Math.round(rect.w)}, h={Math.round(rect.h)}
            <span className="text-white/45">
              {" "}
              / 元画像 {imgSize.width}×{imgSize.height}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function clampRect(
  r: CropRect,
  size: { width: number; height: number }
): CropRect {
  const x = Math.max(0, Math.min(size.width, r.x));
  const y = Math.max(0, Math.min(size.height, r.y));
  const w = Math.max(1, Math.min(size.width - x, r.w));
  const h = Math.max(1, Math.min(size.height - y, r.h));
  return { x, y, w, h };
}

function defaultRect(
  size: { width: number; height: number },
  aspect?: number
): CropRect {
  const margin = 0.1;
  let w = size.width * (1 - margin * 2);
  let h = size.height * (1 - margin * 2);
  if (aspect) {
    if (w / h > aspect) w = h * aspect;
    else h = w / aspect;
  }
  return {
    x: (size.width - w) / 2,
    y: (size.height - h) / 2,
    w,
    h,
  };
}

function enforceAspect(
  next: CropRect,
  start: CropRect,
  aspect: number,
  handle: string,
  W: number,
  H: number
): CropRect {
  // Fit width or height depending on which axis the handle drives.
  let { x, y, w, h } = next;
  if (handle === "n" || handle === "s") {
    w = h * aspect;
    if (handle === "n") {
      x = start.x + start.w / 2 - w / 2;
    } else {
      x = start.x + start.w / 2 - w / 2;
    }
  } else if (handle === "e" || handle === "w") {
    h = w / aspect;
    y = start.y + start.h / 2 - h / 2;
  } else {
    // corner: respect width
    h = w / aspect;
    if (handle.includes("n")) y = start.y + start.h - h;
  }
  // Clamp into image
  if (x < 0) {
    w += x;
    x = 0;
  }
  if (y < 0) {
    h += y;
    y = 0;
  }
  if (x + w > W) w = W - x;
  if (y + h > H) h = H - y;
  return { x, y, w, h };
}
