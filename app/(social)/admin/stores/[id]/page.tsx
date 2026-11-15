import type { Metadata } from "next";
import { StoreCaseScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Local shop · Ruxstar console", robots: { index: false } };

export default async function StoreCasePage({ params }: Props) {
  return <StoreCaseScreen id={(await params).id} />;
}
