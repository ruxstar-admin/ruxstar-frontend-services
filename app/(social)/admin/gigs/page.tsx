import type { Metadata } from "next";
import { GigListingsScreen } from "./screen";

type Props = { searchParams: Promise<{ freelancer?: string | string[]; label?: string | string[] }> };

export const metadata: Metadata = { title: "Gigs · Ruxstar console", robots: { index: false } };

export default async function GigListingsPage({ searchParams }: Props) {
  const { freelancer, label } = await searchParams;
  const id = typeof freelancer === "string" && /^[a-f0-9]{24}$/.test(freelancer) ? freelancer : undefined;
  return <GigListingsScreen freelancer={id} label={id && typeof label === "string" ? label.slice(0, 80) : undefined} />;
}
