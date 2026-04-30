import Link from "next/link";
import { Plus } from "lucide-react";

export default function Fab({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="新規登録"
      className="fixed bottom-6 right-6 z-20 w-[52px] h-[52px] bg-[var(--color-gold-deep)] text-white
        hover:bg-gold active:scale-95 transition-colors duration-150 ease-out
        flex items-center justify-center"
      style={{ borderRadius: 0 }}
    >
      <Plus size={22} strokeWidth={2.2} />
    </Link>
  );
}
