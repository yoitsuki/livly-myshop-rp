import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "リヴリー マイショップ 参考価格めも",
    short_name: "参考価格めも",
    description:
      "リヴリーアイランドのマイショップに並ぶアイテムの参考価格を、画像から取り込んで蓄積するメモアプリ",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#006a71",
    lang: "ja",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
