import type { Metadata, Viewport } from "next";
import {
  Cormorant_Garamond,
  Inter,
  Noto_Sans_JP,
  Noto_Serif_JP,
} from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/lib/firebase/auth";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const notoJp = Noto_Sans_JP({
  variable: "--font-noto-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const notoSerifJp = Noto_Serif_JP({
  variable: "--font-noto-serif-jp",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "リヴリー マイショップ 参考価格めも",
  description:
    "リヴリーアイランドのマイショップに並ぶアイテムの参考価格を、画像から取り込んで蓄積するメモアプリ",
  applicationName: "参考価格めも",
  appleWebApp: {
    capable: true,
    title: "参考価格めも",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${cormorant.variable} ${inter.variable} ${notoJp.variable} ${notoSerifJp.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-cream text-text">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
