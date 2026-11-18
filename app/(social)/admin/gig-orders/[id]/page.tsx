import type { Metadata } from "next";
import { GigOrderCaseScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Freelance order · Ruxstar console", robots: { index: false } };

export default async function GigOrderCasePage({ params }: Props) {
  const { id } = await params;
  return <GigOrderCaseScreen key={id} id={id} />;
}
