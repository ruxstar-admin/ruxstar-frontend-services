import type { Metadata } from "next";
import { ManageGigScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ fresh?: string }> };

export const metadata: Metadata = { title: "Gig · Ruxstar", robots: { index: false } };

/** One of your gigs. `?fresh=1` right after it was made. */
export default async function ManageGigPage({ params, searchParams }: Props) {
  const [{ id }, { fresh }] = await Promise.all([params, searchParams]);
  return <ManageGigScreen key={id} id={id} fresh={fresh === "1"} />;
}
