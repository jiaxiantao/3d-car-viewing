import type { Metadata, Viewport } from "next";

import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "3D 看车 · WebGL 交互演示",
    template: "%s · 3D 看车",
  },
  description:
    "基于 Three.js 与 React Three Fiber 的 3D 看车交互演示：车型切换、车漆配色、车门 / 后备箱 / 车灯 / 双闪 / 启动制动、影棚 / 白天 / 夜晚场景。",
  keywords: ["3D 看车", "WebGL", "Three.js", "React Three Fiber", "GLTF"],
  applicationName: "3D Car Showroom",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#070d18",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
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
