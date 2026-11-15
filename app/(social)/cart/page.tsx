import type { Metadata } from "next";
import { CartScreen } from "./screen";

export const metadata: Metadata = { title: "Your cart · Ruxstar", robots: { index: false } };

export default function CartPage() {
  return <CartScreen />;
}
