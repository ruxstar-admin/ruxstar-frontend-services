import { signedIn } from "./account";
import { api, unwrap } from "./client";
import type { paths } from "./schema";
import type { Page } from "./social";

export type Payment = paths["/v1/account/payments"]["get"]["responses"][200]["content"]["application/json"]["data"][number];
export type PaymentStatus = Payment["status"];

/** What you paid at every business, newest first, one per paid order. */
export const myPayments = async (cursor?: string): Promise<Page<Payment>> => {
  const envelope = await signedIn(() => unwrap(api.GET("/v1/account/payments", { params: { query: { cursor } } })));
  return { items: envelope.data, nextCursor: envelope.meta.nextCursor ?? null };
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: "success" | "warning" | "neutral" | "solid" }> = {
  paid: { label: "Paid", tone: "success" },
  refund_pending: { label: "Refund on its way", tone: "warning" },
  part_refunded: { label: "Part refunded", tone: "solid" },
  refunded: { label: "Refunded", tone: "neutral" },
};
