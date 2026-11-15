import type { Metadata } from "next";
import { ReserveScreen, type ReservePick } from "./screen";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ room?: string; bed?: string; whole?: string; from?: string; stay?: string; n?: string }>;
};

export const metadata: Metadata = { title: "Reserve · Ruxstar", robots: { index: false } };

const ID = /^[a-f0-9]{24}$/;

/** `?room=` opens on that room; `bed`, `whole`, `from`, `stay` and `n` bring the picks back after signing in or verifying. */
export default async function ReservePage({ params, searchParams }: Props) {
  const [{ id }, q] = await Promise.all([params, searchParams]);
  const n = Number(q.n);
  const pick: ReservePick = {
    room: q.room && ID.test(q.room) ? q.room : undefined,
    bed: q.bed && ID.test(q.bed) ? q.bed : undefined,
    whole: q.whole === "1",
    from: q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from) ? q.from : undefined,
    stay: q.stay === "month" || q.stay === "night" ? q.stay : undefined,
    n: Number.isInteger(n) && n >= 1 && n <= 90 ? n : undefined,
  };
  return <ReserveScreen id={id} pick={pick} />;
}
