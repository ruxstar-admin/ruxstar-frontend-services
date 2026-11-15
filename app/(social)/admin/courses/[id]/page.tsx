import type { Metadata } from "next";
import { CourseCaseScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Course · Ruxstar console", robots: { index: false } };

export default async function CourseCasePage({ params }: Props) {
  const { id } = await params;
  return <CourseCaseScreen key={id} id={id} />;
}
