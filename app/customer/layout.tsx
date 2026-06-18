"use client";

import { Suspense } from "react";
import { CustomerShell } from "@/components/customer-shell";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050505]">
          <p className="text-sm text-white/50">Loading…</p>
        </div>
      }
    >
      <CustomerShell>{children}</CustomerShell>
    </Suspense>
  );
}
