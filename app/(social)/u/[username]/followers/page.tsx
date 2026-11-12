import type { Metadata } from "next";
import { PeopleScreen } from "../people";

type Props = { params: Promise<{ username: string }> };

const handle = (raw: string) => decodeURIComponent(raw).trim().replace(/^@/, "").toLowerCase();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `People following @${handle((await params).username)} · Ruxstar`, robots: { index: false } };
}

export default async function FollowersPage({ params }: Props) {
  return <PeopleScreen username={handle((await params).username)} side="followers" />;
}
