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
    <label className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-beige/70 border border-beige focus-within:border-gold/60 transition-colors">
      <Search size={18} className="text-muted shrink-0" strokeWidth={2.2} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-muted text-[15px] text-text"
      />
    </label>
  );
}
