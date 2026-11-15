import type { Metadata } from "next";
import { Suspense } from "react";
import { SupportQueueScreen } from "./screen";

export const metadata: Metadata = { title: "Help tickets · Ruxstar console", robots: { index: false } };

export default function SupportQueuePage() {
  return (
    <Suspense>
      <SupportQueueScreen />
    </Suspense>
  );
}
