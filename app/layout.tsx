import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./tokens.css";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://ruxstar.com"),
  title: "Ruxstar · Live on 30 November",
  description: "Print, events, coaching, and stays from the people around you. Ruxstar goes live on 30 November 2026.",
  openGraph: { title: "Ruxstar · Live on 30 November", siteName: "Ruxstar", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#0D0C12",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
