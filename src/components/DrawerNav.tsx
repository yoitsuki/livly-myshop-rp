"use client";

import { usePathname } from "next/navigation";
import { GuardedLink } from "@/lib/unsavedChanges";
import {
  ChevronRight,
  Crop,
  Home,
  Inbox,
  PlusCircle,
  Tag,
  Settings,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { APP_VERSION } from "@/lib/version";

interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}
type IconCmp = ComponentType<IconProps>;

interface LinkItem {
  href: string;
  label: string;
  icon: IconCmp;
}

interface GroupItem {
  label: string;
  icon: IconCmp;
  /** Routes that count as "inside this group" for active highlighting. */
  matchPrefixes: string[];
  children: LinkItem[];
}

type NavItem = LinkItem | GroupItem;

const items: NavItem[] = [
  { href: "/", label: "ホーム", icon: Home },
  {
    label: "新規登録",
    icon: PlusCircle,
    matchPrefixes: ["/register"],
    children: [
      { href: "/register", label: "登録", icon: PlusCircle },
      { href: "/register/bulk", label: "まとめて登録", icon: PlusCircle },
      { href: "/register/inbox", label: "受信BOX", icon: Inbox },
    ],
  },
  { href: "/inbox", label: "アップロード", icon: Upload },
  { href: "/tags", label: "タグ管理", icon: Tag },
  { href: "/presets", label: "プリセット管理", icon: Crop },
  { href: "/settings", label: "設定", icon: Settings },
];

function isGroup(item: NavItem): item is GroupItem {
  return "children" in item;
}

export default function DrawerNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  // When the drawer opens, auto-expand any group whose route the user
  // is currently on, so they can see where they are.
  useEffect(() => {
    if (!open) return;
    setExpanded((prev) => {
      const next = { ...prev };
      for (const it of items) {
        if (isGroup(it)) {
          if (
            it.matchPrefixes.some((p) =>
              p === "/" ? pathname === "/" : pathname.startsWith(p)
            )
          ) {
            next[it.label] = true;
          }
        }
      }
      return next;
    });
  }, [open, pathname]);

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
        className={`fixed top-0 right-0 z-50 h-dvh w-72 max-w-[80%] bg-[var(--color-cream)] border-l border-[var(--color-line)] transition-transform duration-250 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {/* Header — matches AppHeader Atelier style */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3.5 border-b border-[var(--color-line)]">
          <div className="flex-1 leading-none flex flex-col gap-[3px]">
            <span
              className="text-[22px] font-normal leading-none tracking-[0.16em] text-[var(--color-gold-deep)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              LIVLY
            </span>
            <span
              className="text-[8.5px] font-medium leading-none tracking-[0.42em] text-[var(--color-muted)] uppercase"
              style={{ fontFamily: "var(--font-label)" }}
            >
              MY-SHOP REF
            </span>
          </div>
          <button
            aria-label="メニューを閉じる"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-[var(--color-text)] hover:bg-[var(--color-line-soft)] transition-colors"
          >
            <X size={20} strokeWidth={1.6} />
          </button>
        </div>

        <nav className="py-1 flex-1 overflow-y-auto">
          {items.map((it) => {
            if (!isGroup(it)) {
              return (
                <NavLinkRow
                  key={it.href}
                  item={it}
                  active={pathname === it.href}
                  onClick={onClose}
                />
              );
            }

            const groupActive = it.matchPrefixes.some((p) =>
              p === "/" ? pathname === "/" : pathname.startsWith(p)
            );
            const isOpen = !!expanded[it.label];
            const Icon = it.icon;

            return (
              <div key={it.label}>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [it.label]: !prev[it.label],
                    }))
                  }
                  aria-expanded={isOpen}
                  className={`relative w-full flex items-center gap-3 pl-4 pr-3 py-3 text-[14px] transition-colors text-left ${
                    groupActive
                      ? "text-[var(--color-gold-deep)] bg-[var(--color-line-soft)]"
                      : "text-[var(--color-text)] hover:bg-[var(--color-line-soft)]"
                  }`}
                >
                  {groupActive && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-2 bottom-2 w-[3px] bg-[var(--color-gold)]"
                    />
                  )}
                  <Icon
                    size={18}
                    strokeWidth={groupActive ? 2.2 : 1.8}
                    className={
                      groupActive
                        ? "text-[var(--color-gold-deep)]"
                        : "text-[var(--color-muted)]"
                    }
                  />
                  <span className="flex-1">{it.label}</span>
                  <ChevronRight
                    size={16}
                    strokeWidth={1.8}
                    className={`text-[var(--color-muted)] transition-transform duration-150 ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="bg-[var(--color-cream)]">
                    {it.children.map((c) => {
                      const childActive = pathname === c.href;
                      return (
                        <GuardedLink
                          key={c.href}
                          href={c.href}
                          onClick={onClose}
                          className={`relative flex items-center gap-3 pl-12 pr-4 py-2.5 text-[13px] transition-colors ${
                            childActive
                              ? "text-[var(--color-gold-deep)] bg-[var(--color-line-soft)]"
                              : "text-[var(--color-text)]/85 hover:bg-[var(--color-line-soft)]"
                          }`}
                        >
                          {childActive && (
                            <span
                              aria-hidden
                              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-[var(--color-gold)]"
                            />
                          )}
                          {c.label}
                        </GuardedLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div
          className="px-4 py-3 text-[var(--color-muted)] border-t border-[var(--color-line)] tabular-nums"
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 10.5,
            letterSpacing: "0.04em",
          }}
        >
          ver. {APP_VERSION}
        </div>
      </aside>
    </>
  );
}

function NavLinkRow({
  item,
  active,
  onClick,
}: {
  item: LinkItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <GuardedLink
      href={item.href}
      onClick={onClick}
      className={`relative flex items-center gap-3 pl-4 pr-4 py-3 text-[14px] transition-colors ${
        active
          ? "text-[var(--color-gold-deep)] bg-[var(--color-line-soft)]"
          : "text-[var(--color-text)] hover:bg-[var(--color-line-soft)]"
      }`}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-[3px] bg-[var(--color-gold)]"
        />
      )}
      <Icon
        size={18}
        strokeWidth={active ? 2.2 : 1.8}
        className={
          active ? "text-[var(--color-gold-deep)]" : "text-[var(--color-muted)]"
        }
      />
      {item.label}
    </GuardedLink>
  );
}
