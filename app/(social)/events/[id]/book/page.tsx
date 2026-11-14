import type { Metadata } from "next";
import { BookScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ waitlist?: string }> };

export const metadata: Metadata = { title: "Get tickets · Ruxstar", robots: { index: false } };

/** `?waitlist=<id>` books the tickets held for you from the waitlist. */
export default async function BookPage({ params, searchParams }: Props) {
  const [{ id }, { waitlist }] = await Promise.all([params, searchParams]);
  return <BookScreen id={id} waitlistId={waitlist && /^[a-f\d]{24}$/i.test(waitlist) ? waitlist : undefined} />;
}
