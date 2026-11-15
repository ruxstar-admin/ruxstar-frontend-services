import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MyClassesScreen } from "./screen";

type Props = { searchParams: Promise<{ order?: string }> };

export const metadata: Metadata = { title: "Your classes · Ruxstar", robots: { index: false } };

/** Cashfree sends the parent back here with `?order=<id>`. */
export default async function ClassesPage({ searchParams }: Props) {
  const { order } = await searchParams;
  if (order && /^[a-f\d]{24}$/i.test(order)) redirect(`/classes/${order}?fresh=1`);
  return <MyClassesScreen />;
}
