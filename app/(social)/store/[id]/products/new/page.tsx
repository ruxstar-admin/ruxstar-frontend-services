import type { Metadata } from "next";
import { NewProductScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Add a product · Ruxstar", robots: { index: false } };

export default async function NewProductPage({ params }: Props) {
  return <NewProductScreen id={(await params).id} />;
}
