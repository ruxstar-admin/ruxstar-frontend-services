"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Legacy URL — keeps old /book/:id links working inside the customer app. */
export default function BookBusinessRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = typeof params.businessId === "string" ? params.businessId : "";

  useEffect(() => {
    if (businessId) router.replace(`/customer/book/${businessId}`);
    else router.replace("/customer");
  }, [businessId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505]">
      <p className="text-sm text-white/50">Loading…</p>
    </div>
  );
}
