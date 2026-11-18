import type { Metadata } from "next";
import { GigOrdersScreen } from "./screen";

type Props = { searchParams: Promise<{ freelancer?: string | string[]; label?: string | string[]; status?: string | string[] }> };

export const metadata: Metadata = { title: "Freelance orders · Ruxstar console", robots: { index: false } };

export default async function GigOrdersPage({ searchParams }: Props) {
  const { freelancer, label, status } = await searchParams;
  const id = typeof freelancer === "string" && /^[a-f0-9]{24}$/.test(freelancer) ? freelancer : undefined;
  return (
    <GigOrdersScreen
      freelancer={id}
      label={id && typeof label === "string" ? label.slice(0, 80) : undefined}
      status={typeof status === "string" ? status : undefined}
    />
  );
}
