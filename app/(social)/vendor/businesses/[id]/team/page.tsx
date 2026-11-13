import type { Metadata } from "next";
import { TeamScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Team · Ruxstar", robots: { index: false } };

export default async function TeamPage({ params }: Props) {
  return <TeamScreen id={(await params).id} />;
}
