import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ruxstar · Live on 30 November",
  description: "Ruxstar goes live on 30 November 2026.",
};

export const viewport: Viewport = {
  themeColor: "#F6F4EF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
