import type { Metadata } from "next";
import { EnrolScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ batch?: string }> };

export const metadata: Metadata = { title: "Enrol · Ruxstar", robots: { index: false } };

/** `?batch=<id>` starts with that batch picked, from its Enrol button on the course page. */
export default async function EnrolPage({ params, searchParams }: Props) {
  const [{ id }, { batch }] = await Promise.all([params, searchParams]);
  return <EnrolScreen id={id} batchId={batch && /^[a-f\d]{24}$/i.test(batch) ? batch : undefined} />;
}
