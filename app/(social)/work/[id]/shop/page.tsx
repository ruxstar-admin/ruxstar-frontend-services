import type { Metadata } from "next";
import { BusinessScreen } from "@/app/(social)/vendor/businesses/[id]/screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Shop · Ruxstar", robots: { index: false } };

/** The shop someone works at, with only what the owner allowed. Same as the app. */
export default async function TeamShopPage({ params }: Props) {
  return <BusinessScreen id={(await params).id} team />;
}
