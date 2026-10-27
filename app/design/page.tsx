import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gallery } from "./gallery";

export const metadata: Metadata = {
  title: "Ruxstar design system",
  robots: { index: false, follow: false },
};

/** On in development. In a production build only when DESIGN_GALLERY=on at build time. */
const enabled = process.env.NODE_ENV !== "production" || process.env.DESIGN_GALLERY === "on";

export default function DesignPage() {
  if (!enabled) notFound();
  return <Gallery />;
}
