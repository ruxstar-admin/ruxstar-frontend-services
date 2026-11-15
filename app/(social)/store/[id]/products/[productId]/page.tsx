import type { Metadata } from "next";
import { EditProductScreen } from "./screen";

type Props = { params: Promise<{ id: string; productId: string }> };

export const metadata: Metadata = { title: "Product · Ruxstar", robots: { index: false } };

export default async function EditProductPage({ params }: Props) {
  const { id, productId } = await params;
  return <EditProductScreen id={id} productId={productId} />;
}
