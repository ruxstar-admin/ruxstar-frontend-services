import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { VerifiedTick } from "@/components/kyc/VerifiedTick";
import { Avatar } from "@/components/profile/Avatar";
import { Icon, Tag } from "@/components/ui";
import type { PublicProfile } from "@/lib/api/account";
import { API_URL } from "@/lib/api/client";
import { fetchPublicPosts } from "@/lib/api/social";
import styles from "../profile.module.css";
import { ProfilePosts } from "./posts";
import { ProfileActions, ProfileRelation, ProfileStats, UnlessBlocked } from "./relation";

/** A username, or a user id from a notification; an id redirects to the username. */
const HANDLE = /^(?:[a-z0-9_.]{3,20}|[a-f0-9]{24})$/;

type Props = { params: Promise<{ username: string }> };

/** `/u/@Asha.Rao` and `/u/asha.rao` are the same person; the page redirects to the second. */
const normalise = (raw: string) => decodeURIComponent(raw).trim().replace(/^@/, "").toLowerCase();

/** Shared by the page and its metadata, so a visit makes one API call. */
const loadProfile = cache(async (username: string): Promise<PublicProfile | null> => {
  if (!HANDLE.test(username)) return null;
  const res = await fetch(`${API_URL}/v1/account/profiles/${encodeURIComponent(username)}`, {
    headers: { "X-Client": "web" },
    next: { revalidate: 60 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Profile lookup failed with ${res.status}`);
  return ((await res.json()) as { data: PublicProfile }).data;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await loadProfile(normalise((await params).username));
  if (!profile) return { title: "Profile not found · Ruxstar", robots: { index: false } };

  const title = `${profile.name} (@${profile.username}) · Ruxstar`;
  const description = profile.bio ?? `${profile.name} is on Ruxstar${profile.city ? ` in ${profile.city}` : ""}.`;
  const url = `/u/${profile.username}`;
  const images = profile.avatarUrl ? [{ url: profile.avatarUrl, width: 512, height: 512, alt: profile.name }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { type: "profile", siteName: "Ruxstar", url, title, description, username: profile.username, images },
    twitter: { card: "summary", title, description, images: profile.avatarUrl ? [profile.avatarUrl] : undefined },
  };
}

export default async function ProfilePage({ params }: Props) {
  const raw = (await params).username;
  const username = normalise(raw);
  // In parallel: the posts call costs nothing extra when the profile turns out not to exist.
  const [profile, posts] = await Promise.all([loadProfile(username), HANDLE.test(username) ? fetchPublicPosts(username, "personal") : null]);
  if (!profile) notFound();
  if (raw !== profile.username) permanentRedirect(`/u/${profile.username}`);

  const since = new Date(profile.memberSince).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const badges = [profile.badges.vendor && "Vendor", profile.badges.delivery && "Delivery partner"].filter(Boolean) as string[];
  const structured = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    dateCreated: profile.memberSince,
    mainEntity: {
      "@type": "Person",
      name: profile.name,
      alternateName: `@${profile.username}`,
      identifier: profile.id,
      url: `https://ruxstar.com/u/${profile.username}`,
      ...(profile.bio ? { description: profile.bio } : {}),
      ...(profile.avatarUrl ? { image: profile.avatarUrl } : {}),
    },
  };

  const { posts: postCount, followers, following } = profile.stats;

  return (
    <article className={styles.page}>
      <ProfileRelation ownerId={profile.id} username={profile.username} name={profile.name} counts={{ followers, following }}>
        <header className={styles.header}>
          <div className={styles.photo}>
            <Avatar name={profile.name} url={profile.avatarUrl} size="var(--avatar)" />
          </div>
          <div className={styles.top}>
            <h1 className={styles.username}>{profile.username}</h1>
            <ProfileActions />
          </div>
          <ProfileStats posts={postCount} />
          <div className={styles.about}>
            <p className={styles.name}>
              {profile.name}
              {profile.badges.verified && <VerifiedTick />}
              {badges.map((badge) => (
                <Tag key={badge}>{badge}</Tag>
              ))}
            </p>
            {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
            <ul className={styles.facts}>
              {profile.city && (
                <li>
                  <Icon name="map-pin" size={16} />
                  {profile.city}
                </li>
              )}
              <li>
                <Icon name="calendar" size={16} />
                Member since {since}
              </li>
            </ul>
          </div>
        </header>
        <UnlessBlocked>
          <ProfilePosts ownerId={profile.id} username={profile.username} vendor={profile.badges.vendor} initial={posts ?? { items: [], nextCursor: null }} />
        </UnlessBlocked>
      </ProfileRelation>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
    </article>
  );
}
