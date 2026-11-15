import type { Metadata } from "next";
import { isDashboardSection, sectionTitle } from "../sections";
import { DashboardSectionScreen } from "./screen";

type Props = { params: Promise<{ section: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  return { title: `${isDashboardSection(section) ? sectionTitle(section) : "Dashboard"} · Ruxstar console`, robots: { index: false } };
}

export default async function DashboardSectionPage({ params }: Props) {
  return <DashboardSectionScreen section={(await params).section} />;
}
