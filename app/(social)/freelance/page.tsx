import type { Metadata } from "next";
import { FreelanceHomeScreen } from "./screen";

type Props = { searchParams: Promise<{ fresh?: string }> };

export const metadata: Metadata = { title: "Freelancing · Ruxstar", robots: { index: false } };

/** Your freelancing. `?fresh=1` right after you start. */
export default async function FreelancePage({ searchParams }: Props) {
  const { fresh } = await searchParams;
  return <FreelanceHomeScreen fresh={fresh === "1"} />;
}
