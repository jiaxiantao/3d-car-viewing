import type { Metadata, Viewport } from "next";

import { CAR_SPECS } from "@/lib/car-specs";

import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "3D 看车 · 沉浸式车型展厅",
    template: "%s · 3D 看车",
  },
  description:
    "基于 Three.js 与 React Three Fiber 的 3D 看车交互演示：实时车型切换、车漆配色、车门 / 后备箱 / 车灯 / 双闪 / 启动制动、影棚 / 白天 / 夜晚场景与可分享配置链接。",
  keywords: [
    "3D 看车",
    "3D car",
    "WebGL",
    "Three.js",
    "React Three Fiber",
    "GLTF",
    "汽车展厅",
    "线上展车",
    "看车体验",
  ],
  applicationName: "3D Car Showroom",
  authors: [{ name: "jiaxiantao", url: "https://github.com/jiaxiantao" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: SITE_URL,
    siteName: "3D 看车 · 沉浸式车型展厅",
    title: "3D 看车 · 沉浸式车型展厅",
    description:
      "在浏览器中即时切换 SUV / 小轿车 / 越野车，调节车漆、灯光、车门与场景模式，720° 环车巡检 + 截图分享。",
    images: [
      {
        url: "/shows/car-one.png",
        width: 1600,
        height: 900,
        alt: "3D 看车交互舱整车演示",
      },
      {
        url: "/shows/car-two.png",
        width: 1600,
        height: 900,
        alt: "车门、车灯、车漆等交互控制",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "3D 看车 · 沉浸式车型展厅",
    description:
      "WebGL 真实车模 · 实时灯光与车漆 · 影棚 / 白天 / 夜晚场景 · 一键截图分享。",
    images: ["/shows/car-one.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
  },
  category: "automotive",
};

export const viewport: Viewport = {
  themeColor: "#070d18",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
};

const carJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: Object.values(CAR_SPECS).map((spec, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Car",
      name: spec.label,
      alternateName: spec.englishName,
      description: spec.tagline,
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "CNY",
        lowPrice: Math.round(spec.priceFromWan * 10000),
        availability: "https://schema.org/InStock",
      },
    },
  })),
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(carJsonLd) }}
        />
      </body>
    </html>
  );
}
