import type { Metadata } from "next";
import { PaymentsScreen } from "./screen";

export const metadata: Metadata = { title: "Your payments · Ruxstar", robots: { index: false } };

type Props = { searchParams: Promise<{ open?: string }> };

export default async function PaymentsPage({ searchParams }: Props) {
  const { open } = await searchParams;
  return <PaymentsScreen openId={/^[a-f0-9]{24}$/.test(open ?? "") ? open : undefined} />;
}
