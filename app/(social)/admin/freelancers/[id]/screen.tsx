"use client";

import { useEffect, useRef, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, ReasonForm, date, styles } from "@/components/admin/parts";
import { ratingText } from "@/components/gigs/GigCard";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { Button, ButtonLink, Card, Icon, Skeleton, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { newIdempotencyKey } from "@/lib/api/client";
import { consoleFreelancer, restoreFreelancer, suspendFreelancer, type ConsoleFreelancer } from "@/lib/api/gigs";
import { plural } from "@/lib/gigs";
import { freelancerBadge } from "../screen";

/** Putting a freelancer on hold with a reason they see, or lifting it. The same hold as their business's. */
function HoldActions({ f, onChanged }: { f: ConsoleFreelancer; onChanged: (next: ConsoleFreelancer) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("businesses.manage");
  const [holding, setHolding] = useState(false);
  const [busy, setBusy] = useState<"hold" | "restore" | null>(null);
  const keys = useRef({ hold: newIdempotencyKey(), restore: newIdempotencyKey() });
  if (!canManage) return null;

  async function run(kind: "hold" | "restore", reason = "") {
    setBusy(kind);
    try {
      const k = keys.current[kind];
      const next = kind === "hold" ? await suspendFreelancer(f.businessId, reason, k) : await restoreFreelancer(f.businessId, k);
      keys.current[kind] = newIdempotencyKey();
      setHolding(false);
      onChanged(next);
      toast(kind === "hold" ? "Freelancer put on hold. Their gigs are hidden and they have been told why." : "Hold lifted. The freelancer has been told.", "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(null);
    }
  }

  if (holding) {
    return (
      <ReasonForm
        prompt="Why is this freelancer going on hold? Their gigs hide and they can't sell anything new. Orders already placed carry on. They will see this reason."
        placeholder="For example: the portfolio shows someone else's work."
        confirm="Put on hold"
        busy={busy === "hold"}
        onCancel={() => setHolding(false)}
        onSubmit={(reason) => run("hold", reason)}
      />
    );
  }

  return (
    <div className={styles.actions}>
      {f.suspended ? (
        <Button onClick={() => run("restore")} loading={busy === "restore"} disabled={!!busy}>
          Lift the hold
        </Button>
      ) : (
        <Button variant="danger" onClick={() => setHolding(true)} disabled={!!busy}>
          Put on hold
        </Button>
      )}
    </div>
  );
}

/** One freelancer for the Ruxstar team: who they are, verification, counts, portfolio, holding them, and links to their gigs and orders. */
export function FreelancerCaseScreen({ id }: { id: string }) {
  const onSignedOut = useOnSignedOut();
  const canOrders = useCan("orders.view");
  const canAudit = useCan("audit.view");
  const [f, setF] = useState<ConsoleFreelancer | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    consoleFreelancer(id).then(
      (next) => live && setF(next),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [id, attempt, onSignedOut]);

  const badge = f && freelancerBadge(f);
  const rating = f && ratingText(f.rating);
  const label = f ? `&label=${encodeURIComponent(f.name)}` : "";

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <div>
          <ButtonLink href="/admin/freelancers" variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
            Freelancers
          </ButtonLink>
        </div>

        {error ? (
          <Failed
            error={error}
            onRetry={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          />
        ) : !f || !badge ? (
          <Skeleton height={420} radius={16} />
        ) : (
          <Card as="section" padding="lg" className={styles.page}>
            <div className={styles.head}>
              <div className={styles.row}>
                <Avatar name={f.name} url={f.avatarUrl} size={56} />
                <div>
                  <h1 className={styles.title}>{f.name}</h1>
                  <p className={styles.muted}>{f.headline}</p>
                </div>
              </div>
              <div className={styles.tags}>
                <Tag tone={badge.tone}>{badge.label}</Tag>
              </div>
            </div>
            {f.suspended && (
              <p className={styles.note} data-tone="danger">
                Ruxstar has put this freelancer on hold. Their gigs are hidden.
              </p>
            )}

            <dl className={styles.facts}>
              <Fact label="Category" value={f.categoryLabel} />
              <Fact label="City" value={f.city ?? "Not set"} />
              <Fact label="Verified" value={f.verified ? "Yes" : "Not yet"} warn={!f.verified} />
              <Fact label="Gigs" value={String(f.gigs)} />
              <Fact label="Orders" value={String(f.orders)} />
              {rating && <Fact label="Rating" value={rating} />}
              <Fact label="Skills" value={f.skills.length ? f.skills.join(", ") : "None"} />
              <Fact label="Languages" value={f.languages.join(", ")} />
              <Fact label="Started" value={date(f.createdAt)} />
              <Fact label="Business id" value={f.businessId} />
            </dl>

            {f.bio && (
              <section className={styles.group}>
                <h2 className={styles.subtitle}>About</h2>
                <p className={styles.muted}>{f.bio}</p>
              </section>
            )}

            {(f.portfolio.links.length > 0 || f.portfolio.photos.length > 0) && (
              <section className={styles.group}>
                <h2 className={styles.subtitle}>Portfolio</h2>
                <p className={styles.muted}>{plural(f.portfolio.photos.length, "photo")}</p>
                {f.portfolio.links.map((l) => (
                  <a key={l.id} href={l.url} target="_blank" rel="noreferrer noopener">
                    {`${l.title} ›`}
                  </a>
                ))}
              </section>
            )}

            <HoldActions f={f} onChanged={setF} />

            <div className={styles.actions}>
              <ButtonLink href={`/admin/gigs?freelancer=${f.businessId}${label}`} variant="ghost" icon={<Icon name="stack" size={18} />}>
                Their gigs
              </ButtonLink>
              {canOrders && (
                <ButtonLink href={`/admin/gig-orders?freelancer=${f.businessId}${label}`} variant="ghost" icon={<Icon name="receipt" size={18} />}>
                  Their orders
                </ButtonLink>
              )}
              <ButtonLink href={`/admin/businesses/${f.businessId}`} variant="ghost" icon={<Icon name="store" size={18} />}>
                Open the business
              </ButtonLink>
              <ButtonLink href={`/admin/users/${f.ownerId}`} variant="ghost" icon={<Icon name="user" size={18} />}>
                Open the account
              </ButtonLink>
              <ButtonLink href={`/gigs/freelancer/${f.businessId}`} variant="ghost" icon={<Icon name="share" size={18} />}>
                See their page
              </ButtonLink>
              {canAudit && (
                <ButtonLink href={`/admin/audit?target=${f.businessId}`} variant="ghost" icon={<Icon name="clock" size={18} />}>
                  History for this freelancer
                </ButtonLink>
              )}
            </div>
          </Card>
        )}
      </div>
    </Needs>
  );
}
