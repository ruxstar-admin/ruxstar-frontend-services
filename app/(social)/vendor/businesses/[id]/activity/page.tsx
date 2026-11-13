import type { Metadata } from "next";
import { ActivityScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ by?: string; name?: string }> };

export const metadata: Metadata = { title: "Activity · Vendor portal", robots: { index: false } };

export default async function ActivityPage({ params, searchParams }: Props) {
  const [{ id }, { by, name }] = await Promise.all([params, searchParams]);
  return <ActivityScreen id={id} by={by} name={name} />;
}
