import type { Metadata } from "next";
import { PayoutsScreen } from "./screen";

export const metadata: Metadata = { title: "Payouts · Ruxstar console", robots: { index: false } };

export default function PayoutsPage() {
  return <PayoutsScreen />;
}
