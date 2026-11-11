import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditScreen } from "./screen";

export const metadata: Metadata = { title: "Audit log · Ruxstar console", robots: { index: false } };

export default function AuditPage() {
  return (
    <Suspense>
      <AuditScreen />
    </Suspense>
  );
}
