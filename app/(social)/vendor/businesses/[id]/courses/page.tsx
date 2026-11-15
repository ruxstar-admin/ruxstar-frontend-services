import type { Metadata } from "next";
import { BusinessCoursesScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Courses · Ruxstar", robots: { index: false } };

export default async function BusinessCoursesPage({ params }: Props) {
  return <BusinessCoursesScreen id={(await params).id} />;
}
