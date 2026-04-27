import Link from "next/link";
import { Plus } from "lucide-react";

export default function Fab({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="新規登録"
      className="fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-gold text-white shadow-[0_8px_20px_-6px_rgba(4,115,102,0.55)] hover:bg-gold-deep active:scale-95 transition-all flex items-center justify-center"
    >
      <Plus size={26} strokeWidth={2.6} />
    </Link>
  );
}
