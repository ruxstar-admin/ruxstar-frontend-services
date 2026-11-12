import type { Metadata } from "next";
import { PeopleScreen } from "../people";

type Props = { params: Promise<{ username: string }> };

const handle = (raw: string) => decodeURIComponent(raw).trim().replace(/^@/, "").toLowerCase();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `People @${handle((await params).username)} follows · Ruxstar`, robots: { index: false } };
}

export default async function FollowingPage({ params }: Props) {
  return <PeopleScreen username={handle((await params).username)} side="following" />;
}
