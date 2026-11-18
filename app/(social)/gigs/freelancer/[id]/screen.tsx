"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink, Icon } from "@/components/ui";
import { Avatar } from "@/components/profile/Avatar";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { GigCard } from "@/components/gigs/GigCard";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { getFreelancer, type FreelancerPage } from "@/lib/api/gigs";
import { ratingLine } from "@/lib/api/reviews";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import styles from "@/components/gigs/gigs.module.css";

const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

function PageView({ page }: { page: FreelancerPage }) {
  const me = useMe();
  const own = !!me && me.id === page.userId;
  const where = [page.categoryLabel, page.city].filter(Boolean).join(" · ");
  const { photos, links } = page.portfolio;

  return (
    <div className={order.page}>
      <div className={styles.profile}>
        <Avatar name={page.name} url={page.avatarUrl} size={72} />
        <div className={styles.profileText}>
          <h1>{page.name}</h1>
          <p>{page.headline}</p>
          <p className={order.small}>{where}</p>
        </div>
      </div>

      <div className={styles.facts}>
        {page.rating && (
          <span>
            <Icon name="star" size={16} />
            {ratingLine(page.rating)}
          </span>
        )}
        {page.languages.length > 0 && (
          <span>
            <Icon name="chat" size={16} />
            {`Speaks ${page.languages.join(", ")}`}
          </span>
        )}
        <span>
          <Icon name="calendar" size={16} />
          {`On Ruxstar since ${monthYear(page.memberSince)}`}
        </span>
      </div>

      {!own && (
        <div>
          <ButtonLink href={`/messages/with/${page.userId}`} variant="secondary" icon={<Icon name="chat" size={18} />}>
            {`Message ${page.name}`}
          </ButtonLink>
        </div>
      )}

      {page.bio && (
        <section className={order.section}>
          <h2 className={order.overline}>About</h2>
          <p className={shop.text}>{page.bio}</p>
        </section>
      )}
      {page.skills.length > 0 && (
        <section className={order.section}>
          <h2 className={order.overline}>Skills</h2>
          <p>{page.skills.join(" · ")}</p>
        </section>
      )}

      {(photos.length > 0 || links.length > 0) && (
        <section className={order.section}>
          <h2 className={order.overline}>Portfolio</h2>
          {photos.length > 0 && (
            <ul className={styles.portfolio}>
              {photos.map((p, i) => (
                <li key={p.id}>
                  <img src={p.url} width={p.width} height={p.height} alt={`Work by ${page.name}, ${i + 1}`} loading="lazy" decoding="async" />
                </li>
              ))}
            </ul>
          )}
          {links.length > 0 && (
            <ul className={styles.links}>
              {links.map((l) => (
                <li key={l.id}>
                  <Icon name="share" size={16} />
                  <a href={l.url} target="_blank" rel="noreferrer noopener">
                    {l.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className={order.section}>
        <h2 className={order.overline}>Gigs</h2>
        {page.gigs.length ? (
          <ul className={shop.grid}>
            {page.gigs.map((g, i) => (
              <li key={g.id}>
                <GigCard gig={g} index={i} hideFreelancer />
              </li>
            ))}
          </ul>
        ) : (
          <p className={order.small}>No gigs live right now. Message them to ask for a custom offer.</p>
        )}
      </section>
    </div>
  );
}

/** A freelancer's page: who they are, their skills and portfolio, and their live gigs. Same as the app. */
export function FreelancerScreen({ id, initial }: { id: string; initial: FreelancerPage | null }) {
  const me = useMe();
  const [full, setFull] = useState<FreelancerPage | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    () =>
      getFreelancer(id).then(
        (p) => {
          setFull(p);
          setError(null);
        },
        (err: unknown) => setError(err),
      ),
    [id],
  );

  useEffect(() => {
    if (me === undefined) return;
    if (me === null) {
      if (!initial) void load();
      return;
    }
    void load();
  }, [me, load, initial]);

  const page = full ?? initial;
  if (page) return <PageView page={page} />;
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Freelancer not found" : "Could not load this freelancer"}>
        <p>{gone ? "They may have stopped freelancing or the link is wrong." : formError(error).message}</p>
        {gone ? (
          <ButtonLink href="/discover?category=gigs" variant="secondary">
            Find a freelancer
          </ButtonLink>
        ) : (
          <Button variant="secondary" icon={<Icon name="refresh" size={16} />} onClick={() => void load()}>
            Try again
          </Button>
        )}
      </Empty>
    );
  }
  return (
    <div className={order.page} aria-busy>
      <div className={shop.skeletonCard} />
    </div>
  );
}
