import type { Metadata } from "next";
import { ManageEventScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ fresh?: string }> };

export const metadata: Metadata = { title: "Event · Ruxstar", robots: { index: false } };

/** `?fresh=1` right after the form saves a new draft. */
export default async function ManageEventPage({ params, searchParams }: Props) {
  const [{ id }, { fresh }] = await Promise.all([params, searchParams]);
  return <ManageEventScreen id={id} fresh={fresh === "1"} />;
}
