import type { Metadata } from "next";
import { BedMapScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> };

export const metadata: Metadata = { title: "Bed map · Ruxstar", robots: { index: false } };

/** `?from=YYYY-MM-DD` opens the week starting that day. */
export default async function BedMapPage({ params, searchParams }: Props) {
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  return <BedMapScreen id={id} from={from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined} />;
}
