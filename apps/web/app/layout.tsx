import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";

const sans = localFont({
  src: "../public/fonts/GetOnSans.ttf",
  variable: "--font-sans",
});

const display = localFont({
  src: "../public/fonts/GetOnDisplay.ttf",
  variable: "--font-display",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Get-On | Website builder for small businesses",
    template: "%s | Get-On",
  },
  description:
    "Get your business online in minutes. Build your website with simple tools and a free get-on.tech address.",
  openGraph: {
    title: "Get your business online in minutes.",
    description:
      "No technical skills needed. Start free and get a simple website for your business.",
    siteName: "Get-On",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
