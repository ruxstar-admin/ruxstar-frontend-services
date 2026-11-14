import type { Metadata } from "next";
import { GateScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Gate · Ruxstar", robots: { index: false } };

export default async function GatePage({ params }: Props) {
  const { id } = await params;
  return <GateScreen key={id} id={id} />;
}
