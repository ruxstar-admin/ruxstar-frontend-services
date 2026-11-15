import type { Metadata } from "next";
import { ManageCourseScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ fresh?: string }> };

export const metadata: Metadata = { title: "Course · Ruxstar", robots: { index: false } };

export default async function ManageCoursePage({ params, searchParams }: Props) {
  const [{ id }, { fresh }] = await Promise.all([params, searchParams]);
  return <ManageCourseScreen id={id} fresh={fresh === "1"} />;
}
