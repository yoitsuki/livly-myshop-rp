"use client";

import { Search } from "lucide-react";

export default function SearchBar({
  value,
  onChange,
  placeholder = "アイテム名・カテゴリで検索",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <label
      className="flex items-center gap-2 px-3 bg-white border border-[var(--color-line)]
        focus-within:border-gold focus-within:shadow-[var(--shadow-focus)]
        transition-all duration-150 ease-out"
      style={{ height: 42, borderRadius: 0 }}
    >
      <Search size={18} className="text-muted shrink-0" strokeWidth={1.6} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-muted/80 text-[14px] text-text"
        style={{ fontFamily: "var(--font-body)" }}
      />
    </label>
  );
}
