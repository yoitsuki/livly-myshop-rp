import type { Metadata, Viewport } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const rounded = M_PLUS_Rounded_1c({
  variable: "--font-rounded",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "リヴリー マイショップ 参考価格めも",
  description:
    "リヴリーアイランドのマイショップに並ぶアイテムの参考価格を、画像から取り込んで蓄積するメモアプリ",
};

export const viewport: Viewport = {
  themeColor: "#fff6e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${rounded.variable} h-full antialiased`}>
      <body className="min-h-full bg-cream text-text">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
