import type { Metadata } from "next";
import { MemberScreen } from "../member";

type Props = { params: Promise<{ id: string; memberId: string }> };

export const metadata: Metadata = { title: "Team member · Ruxstar", robots: { index: false } };

export default async function MemberPage({ params }: Props) {
  const { id, memberId } = await params;
  return <MemberScreen id={id} memberId={memberId} />;
}
