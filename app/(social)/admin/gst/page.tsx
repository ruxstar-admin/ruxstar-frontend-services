import type { Metadata } from "next";
import { isGstModule } from "../modules/labels";
import { GstScreen } from "./screen";

export const metadata: Metadata = { title: "GST · Ruxstar console", robots: { index: false } };

type Props = { searchParams: Promise<{ module?: string }> };

export default async function GstPage({ searchParams }: Props) {
  const { module } = await searchParams;
  return <GstScreen module={isGstModule(module) ? module : undefined} />;
}
