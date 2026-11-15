import type { Metadata } from "next";
import { BookScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ court?: string; date?: string }> };

export const metadata: Metadata = { title: "Book a slot · Ruxstar", robots: { index: false } };

/** `?court=` opens on that court and `?date=YYYY-MM-DD` on that day, for links from the ground page and back from sign-in. */
export default async function BookPage({ params, searchParams }: Props) {
  const [{ id }, { court, date }] = await Promise.all([params, searchParams]);
  return <BookScreen id={id} courtId={court} date={date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined} />;
}
