import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewScreen } from "./screen";

export const metadata: Metadata = { title: "Verification review · Ruxstar", robots: { index: false } };

export default function KycReviewPage() {
  return (
    <Suspense>
      <ReviewScreen />
    </Suspense>
  );
}
