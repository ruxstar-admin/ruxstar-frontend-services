import type { Metadata } from "next";
import { ReviewScreen } from "./screen";

export const metadata: Metadata = { title: "Verification review · Ruxstar", robots: { index: false } };

export default function KycReviewPage() {
  return <ReviewScreen />;
}
