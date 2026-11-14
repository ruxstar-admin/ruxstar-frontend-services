import type { Metadata } from "next";
import { DeliveryVerifyScreen } from "./screen";

export const metadata: Metadata = { title: "Delivery partner · Ruxstar", robots: { index: false } };

export default function DeliveryVerifyPage() {
  return <DeliveryVerifyScreen />;
}
