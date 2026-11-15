import type { Metadata } from "next";
import { CourseStudentsScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Students · Ruxstar", robots: { index: false } };

export default async function CourseStudentsPage({ params }: Props) {
  return <CourseStudentsScreen id={(await params).id} />;
}
