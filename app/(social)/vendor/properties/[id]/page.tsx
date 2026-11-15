import type { Metadata } from "next";
import { ManagePropertyScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ fresh?: string }> };

export const metadata: Metadata = { title: "Property · Ruxstar", robots: { index: false } };

export default async function ManagePropertyPage({ params, searchParams }: Props) {
  const [{ id }, { fresh }] = await Promise.all([params, searchParams]);
  return <ManagePropertyScreen id={id} fresh={fresh === "1"} />;
}
