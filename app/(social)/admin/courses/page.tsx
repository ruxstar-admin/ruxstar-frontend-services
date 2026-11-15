import type { Metadata } from "next";
import { CoursesScreen } from "./screen";

export const metadata: Metadata = { title: "Courses · Ruxstar console", robots: { index: false } };

export default function CoursesPage() {
  return <CoursesScreen />;
}
