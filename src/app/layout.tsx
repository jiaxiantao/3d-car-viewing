import type { Metadata, Viewport } from "next";

import { siteJsonLdScript } from "@/lib/site-json-ld";
import {
  AUTHOR_NAME,
  GITHUB_OWNER_URL,
  SITE_APPLICATION_NAME,
  SITE_ORIGIN,
  SITE_TAGLINE,
  SITE_TITLE,
  absoluteSiteUrl,
} from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: SITE_TITLE,
    template: "%s · 3D 看车",
  },
  description: SITE_TAGLINE,
  applicationName: SITE_APPLICATION_NAME,
  authors: [{ name: AUTHOR_NAME, url: GITHUB_OWNER_URL }],
  creator: AUTHOR_NAME,
  keywords: [
    "3D 看车",
    "3D car showroom",
    "WebGL",
    "Three.js",
    "React Three Fiber",
    "GLTF",
    "GLB",
    "car configurator",
  ],
  alternates: {
    canonical: absoluteSiteUrl("/"),
    types: {
      "text/plain": absoluteSiteUrl("/llms.txt"),
    },
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: absoluteSiteUrl("/"),
    siteName: SITE_APPLICATION_NAME,
    title: SITE_TITLE,
    description: SITE_TAGLINE,
    images: [
      {
        url: "/shows/car-one.png",
        alt: "3D 看车交互舱中的小米 SU7 Ultra",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_TAGLINE,
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: siteJsonLdScript() }} />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.1),transparent_28%),linear-gradient(180deg,#020617_0%,#020817_55%,#020617_100%)]"
        />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
