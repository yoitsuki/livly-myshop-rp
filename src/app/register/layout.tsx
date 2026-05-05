import { BulkDraftProvider } from "@/lib/bulk/context";

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BulkDraftProvider>{children}</BulkDraftProvider>;
}
