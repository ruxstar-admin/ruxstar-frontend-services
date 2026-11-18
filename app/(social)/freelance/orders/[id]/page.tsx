import type { Metadata } from "next";
import { DeskGigOrderScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Freelance order · Ruxstar", robots: { index: false } };

export default async function DeskGigOrderPage({ params }: Props) {
  const { id } = await params;
  return <DeskGigOrderScreen key={id} id={id} />;
}
