import type { Metadata } from "next";
import { DemoScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Book a demo class · Ruxstar", robots: { index: false } };

export default async function DemoPage({ params }: Props) {
  return <DemoScreen id={(await params).id} />;
}
