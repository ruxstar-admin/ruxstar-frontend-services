import type { Metadata } from "next";
import { MemberScreen } from "../member";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Invite someone · Ruxstar", robots: { index: false } };

export default async function InvitePage({ params }: Props) {
  return <MemberScreen id={(await params).id} />;
}
