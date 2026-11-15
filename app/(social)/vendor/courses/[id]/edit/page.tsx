import type { Metadata } from "next";
import { CourseForm } from "@/components/coaching/CourseForm";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Edit course · Ruxstar", robots: { index: false } };

export default async function EditCoursePage({ params }: Props) {
  return <CourseForm courseId={(await params).id} />;
}
