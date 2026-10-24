import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";
import "@get-on/renderer/styles.css";
import { themeInitScript } from "@/lib/theme";

const bricolage = localFont({
  src: "./fonts/bricolage-grotesque-latin.woff2",
  weight: "600 700",
  display: "swap",
  variable: "--font-bricolage",
});

const figtree = localFont({
  src: "./fonts/figtree-latin.woff2",
  weight: "400 700",
  display: "swap",
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Get-On: Get your business online in minutes",
    template: "%s | Get-On",
  },
  description:
    "Build a simple website for your business with AI or by hand. Free web address, no technical skills needed.",
  openGraph: {
    title: "Get your business online in minutes.",
    description:
      "Build a simple website for your business with AI or by hand. Free web address, no technical skills needed.",
    siteName: "Get-On",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${figtree.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
