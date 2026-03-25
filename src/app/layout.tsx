import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "スタディコンパス — 中学受験",
  description:
    "数字とグラフで努力を可視化。自主学習がキラキラ伸びる勉強記録アプリ。",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "スタディコンパス" },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
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
    <html lang="ja">
      <body className="min-h-dvh font-sans antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
