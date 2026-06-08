"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { getToken, getUserRole, getVendorKycStatus, vendorDestination } from "@/lib/api";

export default function BusinessPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const raw = localStorage.getItem("ruxstar_user");
    if (raw) {
      try {
        const user = JSON.parse(raw);
        if (getUserRole(user) !== "vendor") {
          router.replace("/customer");
          return;
        }
      } catch {
        router.replace("/login");
        return;
      }
    }

    getVendorKycStatus()
      .then((kyc) => {
        const dest = vendorDestination(kyc);
        if (dest !== "/business") {
          router.replace(dest);
          return;
        }
        setReady(true);
      })
      .catch(() => router.replace("/business/kyc"));
  }, [router]);

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
        <span className="text-lg font-semibold tracking-tight">Ruxstar Business</span>
        <LogoutButton />
      </header>
      <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6">
        <p className="text-sm text-white/50">Business dashboard — coming soon</p>
      </main>
    </div>
  );
}
