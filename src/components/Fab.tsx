import Link from "next/link";
import { Plus } from "lucide-react";

export default function Fab({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="新規登録"
      className="fixed bottom-6 right-6 z-20 w-12 h-12 rounded-full bg-gold text-white
        shadow-[var(--shadow-fab)] hover:bg-gold-deep active:scale-95
        transition-all duration-150 ease-out flex items-center justify-center"
    >
      <Plus size={22} strokeWidth={2.6} />
    </Link>
  );
}
