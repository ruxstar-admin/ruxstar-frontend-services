import type { Metadata } from "next";
import { FreelancerCaseScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Freelancer · Ruxstar console", robots: { index: false } };

export default async function FreelancerCasePage({ params }: Props) {
  const { id } = await params;
  return <FreelancerCaseScreen key={id} id={id} />;
}
