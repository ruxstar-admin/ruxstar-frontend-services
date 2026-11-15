import type { Metadata } from "next";
import { EnrolmentScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ fresh?: string }> };

export const metadata: Metadata = { title: "Your class · Ruxstar", robots: { index: false } };

/** `?fresh=1` after enrolling or paying shows the confirmation at the top. */
export default async function EnrolmentPage({ params, searchParams }: Props) {
  const [{ id }, { fresh }] = await Promise.all([params, searchParams]);
  return <EnrolmentScreen id={id} fresh={fresh === "1"} />;
}
