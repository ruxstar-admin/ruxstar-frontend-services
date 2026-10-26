import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const fraunces = localFont({
  src: "./fonts/fraunces-display-600.woff2",
  weight: "600",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ruxstar.com"),
  title: "Ruxstar · Live on 30 November",
  description: "Print, events, coaching, and stays from the people around you. Ruxstar goes live on 30 November 2026.",
  openGraph: { title: "Ruxstar · Live on 30 November", siteName: "Ruxstar", type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F4EF" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0E10" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
