import type { AppNotification } from "@/lib/api";

/** Where a POD notification should open in the vendor portal. */
export function vendorNotificationHref(n: AppNotification): string | null {
  if (n.data?.kind === "pod") {
    const orderId = typeof n.data.orderId === "string" ? n.data.orderId : "";
    return orderId ? `/business/print-orders/${orderId}` : "/business/print-orders";
  }
  return null;
}

/** Where a POD notification should open in the customer portal. */
export function customerNotificationHref(n: AppNotification): string | null {
  if (n.data?.kind === "pod") {
    const orderId = typeof n.data.orderId === "string" ? n.data.orderId : "";
    return orderId ? `/customer/print/${orderId}` : "/customer/print";
  }
  return null;
}
