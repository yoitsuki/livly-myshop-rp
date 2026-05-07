"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui";

interface UnsavedChangesContextValue {
  /**
   * Register a dirty source. Returns a cleanup that removes it again. The
   * provider treats the union of all registered sources — navigation is
   * gated whenever any source reports dirty.
   */
  register: (dirty: boolean) => () => void;
  /**
   * Header / drawer navigation calls this. If any registered source is
   * dirty, opens the confirm dialog and queues the destination; otherwise
   * navigates immediately via router.push.
   */
  requestNavigate: (href: string) => void;
}

const Ctx = createContext<UnsavedChangesContextValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const dirtyIds = useRef<Set<number>>(new Set());
  const counter = useRef(0);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const register = useCallback((dirty: boolean) => {
    const id = ++counter.current;
    if (dirty) dirtyIds.current.add(id);
    return () => {
      dirtyIds.current.delete(id);
    };
  }, []);

  const requestNavigate = useCallback(
    (href: string) => {
      if (dirtyIds.current.size === 0) {
        router.push(href);
        return;
      }
      setPendingHref(href);
    },
    [router]
  );

  const onCancel = () => setPendingHref(null);
  const onConfirm = () => {
    const href = pendingHref;
    dirtyIds.current.clear();
    setPendingHref(null);
    if (href) router.push(href);
  };

  return (
    <Ctx.Provider value={{ register, requestNavigate }}>
      {children}
      <ConfirmDialog
        open={pendingHref !== null}
        message={
          "編集中のデータがあります。\n" +
          "このページを離れると入力内容は失われます。\n" +
          "移動してよろしいですか？"
        }
        confirmLabel="移動する"
        cancelLabel="戻る"
        variant="primary"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </Ctx.Provider>
  );
}

export function useUnsavedChanges() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("UnsavedChangesProvider missing");
  }
  return ctx;
}

/**
 * Edit pages call this with their current "dirty" state. Each call
 * registers an independent source, so several components in the same tree
 * (e.g. a page plus a modal inside it) all contribute via OR semantics.
 * The registration is cleaned up on unmount so the next page starts clean.
 */
export function useDirtyTracker(dirty: boolean) {
  const { register } = useUnsavedChanges();
  useEffect(() => {
    return register(dirty);
  }, [dirty, register]);
}

type GuardedLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & {
  href: string;
};

/**
 * Drop-in replacement for next/link's <Link> that routes through
 * `requestNavigate`. Used by header / drawer so that any in-shell
 * navigation away from a dirty edit page is gated by the confirm dialog.
 * Modifier-clicks (cmd/ctrl/shift/middle) are passed through to the
 * browser so users can still open in a new tab.
 */
export function GuardedLink({ href, onClick, children, ...rest }: GuardedLinkProps) {
  const { requestNavigate } = useUnsavedChanges();
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (onClick) onClick(e);
        if (e.defaultPrevented) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          return;
        }
        e.preventDefault();
        requestNavigate(href);
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
