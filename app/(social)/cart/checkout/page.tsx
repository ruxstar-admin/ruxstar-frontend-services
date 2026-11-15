import type { Metadata } from "next";
import { CheckoutScreen } from "./screen";

export const metadata: Metadata = { title: "Checkout · Ruxstar", robots: { index: false } };

export default function CheckoutPage() {
  return <CheckoutScreen />;
}
