"use client";

import { useParams } from "next/navigation";
import { CustomerBookFlow } from "@/components/customer-book-flow";

export default function CustomerBookPage() {
  const params = useParams();
  const businessId = typeof params.businessId === "string" ? params.businessId : "";

  if (!businessId) {
    return <p className="text-sm text-zinc-500">Invalid booking link.</p>;
  }

  return <CustomerBookFlow businessId={businessId} isLoggedInCustomer />;
}
