import type { Metadata } from "next";
import { ClassScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Class · Ruxstar", robots: { index: false } };

export default async function ClassPage({ params }: Props) {
  return <ClassScreen id={(await params).id} />;
}
