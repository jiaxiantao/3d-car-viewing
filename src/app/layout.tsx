import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "3D 看车",
  description: "基于 Three.js 的 3D 看车交互演示：车门、灯光、车漆、环车巡检与 GLB 车型切换。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="relative min-h-full flex flex-col bg-[#020617] text-foreground">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.1),transparent_28%),linear-gradient(180deg,#020617_0%,#020817_55%,#020617_100%)]"
        />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
