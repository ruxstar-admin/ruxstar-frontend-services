import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { ButtonLink, Icon, Tag } from "@/components/ui";
import type { PublicProfile } from "@/lib/api/account";
import { API_URL } from "@/lib/api/client";
import styles from "../profile.module.css";

const HANDLE = /^[a-z0-9_.]{3,20}$/;

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

const linkLabel = (link: string) => link.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
const safeLink = (link: string | null) => (link && /^https?:\/\//.test(link) ? link : null);

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
  const profile = await loadProfile(normalise(raw));
  if (!profile) notFound();
  if (raw !== profile.username) permanentRedirect(`/u/${profile.username}`);

  const link = safeLink(profile.link);
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
      ...(link ? { sameAs: [link] } : {}),
    },
  };

  return (
    <article className={styles.card}>
      <Avatar name={profile.name} url={profile.avatarUrl} size={128} />
      <div className={styles.identity}>
        <h1 className={styles.name}>{profile.name}</h1>
        <p className={styles.handle}>@{profile.username}</p>
      </div>
      {badges.length > 0 && (
        <div className={styles.badges}>
          {badges.map((badge) => (
            <Tag key={badge}>{badge}</Tag>
          ))}
        </div>
      )}
      {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
      <ul className={styles.facts}>
        {profile.city && (
          <li>
            <Icon name="map-pin" size={16} />
            {profile.city}
          </li>
        )}
        {link && (
          <li>
            <Icon name="link" size={16} />
            <a href={link} rel="nofollow ugc noopener" target="_blank">
              {linkLabel(link)}
            </a>
          </li>
        )}
        <li>
          <Icon name="calendar" size={16} />
          Member since {since}
        </li>
      </ul>
      <div className={styles.cta}>
        <p>Print, events, coaching and stays from the people around you.</p>
        <ButtonLink href="/signup" size="lg">
          Join Ruxstar
        </ButtonLink>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
    </article>
  );
}
