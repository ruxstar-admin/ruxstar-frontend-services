import type { Metadata } from "next";
import { CourseForm } from "@/components/coaching/CourseForm";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "New course · Ruxstar", robots: { index: false } };

export default async function NewCoursePage({ params }: Props) {
  return <CourseForm businessId={(await params).id} />;
}
