import type { Metadata } from "next";
import { WorkPlaceScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Work · Ruxstar", robots: { index: false } };

export default async function WorkPlacePage({ params }: Props) {
  return <WorkPlaceScreen id={(await params).id} />;
}
