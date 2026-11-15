import type { Metadata } from "next";
import { BookingScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ fresh?: string }> };

export const metadata: Metadata = { title: "Your booking · Ruxstar", robots: { index: false } };

/** `?fresh=1` after booking or paying shows the confirmation at the top. */
export default async function BookingPage({ params, searchParams }: Props) {
  const [{ id }, { fresh }] = await Promise.all([params, searchParams]);
  return <BookingScreen id={id} fresh={fresh === "1"} />;
}
