"use client";

import { LogoutButton } from "@/components/logout-button";
import { useRequireAuth } from "@/hooks/use-require-auth";

export default function DeliveryPage() {
  const { ready } = useRequireAuth({ roles: ["delivery"] });

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-white/50">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight">Ruxstar Delivery</span>
        <LogoutButton />
      </header>
      <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6">
        <p className="text-sm text-white/50">Delivery dashboard — part of Version-2 coming soon</p>
      </main>
    </div>
  );
}
