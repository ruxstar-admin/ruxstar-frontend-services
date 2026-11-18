import type { Metadata } from "next";
import { GigOrderScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ fresh?: string }> };

export const metadata: Metadata = { title: "Your freelance order · Ruxstar", robots: { index: false } };

/** `?fresh=1` after paying shows the confirmation at the top. */
export default async function GigOrderPage({ params, searchParams }: Props) {
  const [{ id }, { fresh }] = await Promise.all([params, searchParams]);
  return <GigOrderScreen key={id} id={id} fresh={fresh === "1"} />;
}
