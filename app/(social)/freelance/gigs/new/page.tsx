import type { Metadata } from "next";
import { GigEditor } from "@/components/gigs/GigEditor";

export const metadata: Metadata = { title: "New gig · Ruxstar", robots: { index: false } };

export default function NewGigPage() {
  return <GigEditor />;
}
