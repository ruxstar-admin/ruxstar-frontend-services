import type { Metadata } from "next";
import { ManageGroundScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ fresh?: string }> };

export const metadata: Metadata = { title: "Ground · Ruxstar", robots: { index: false } };

export default async function ManageGroundPage({ params, searchParams }: Props) {
  const [{ id }, { fresh }] = await Promise.all([params, searchParams]);
  return <ManageGroundScreen id={id} fresh={fresh === "1"} />;
}
