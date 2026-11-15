import type { Metadata } from "next";
import { StayScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ fresh?: string }> };

export const metadata: Metadata = { title: "Your stay · Ruxstar", robots: { index: false } };

/** `?fresh=1` after paying shows the confirmation at the top. */
export default async function StayPage({ params, searchParams }: Props) {
  const [{ id }, { fresh }] = await Promise.all([params, searchParams]);
  return <StayScreen id={id} fresh={fresh === "1"} />;
}
