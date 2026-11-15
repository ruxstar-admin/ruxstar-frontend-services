import type { Metadata } from "next";
import { PropertyCaseScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Property · Ruxstar console", robots: { index: false } };

export default async function PropertyCasePage({ params }: Props) {
  const { id } = await params;
  return <PropertyCaseScreen key={id} id={id} />;
}
