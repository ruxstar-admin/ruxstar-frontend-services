import type { Metadata } from "next";
import { BoardScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> };

export const metadata: Metadata = { title: "Board · Ruxstar", robots: { index: false } };

export default async function BoardPage({ params, searchParams }: Props) {
  const [{ id }, { date }] = await Promise.all([params, searchParams]);
  return <BoardScreen id={id} date={date} />;
}
