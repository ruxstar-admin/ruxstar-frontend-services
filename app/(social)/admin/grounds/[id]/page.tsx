import type { Metadata } from "next";
import { GroundCaseScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Ground · Ruxstar console", robots: { index: false } };

export default async function GroundCasePage({ params }: Props) {
  const { id } = await params;
  return <GroundCaseScreen key={id} id={id} />;
}
