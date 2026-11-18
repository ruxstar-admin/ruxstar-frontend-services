"use client";

import { useEffect, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, ReasonForm, date, styles } from "@/components/admin/parts";
import { GigPhoto, ratingText } from "@/components/gigs/GigCard";
import { PackageCard } from "@/components/gigs/pieces";
import { useOnSignedOut } from "@/components/social/session";
import { useActionKey } from "@/components/stays/desk";
import { Button, ButtonLink, Card, Icon, Skeleton, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { consoleGig, takeDownGig, type ConsoleGig } from "@/lib/api/gigs";
import { GIG_STATUS, sortedPackages } from "@/lib/gigs";
import gigs from "@/components/gigs/gigs.module.css";

/** One gig for the Ruxstar team: its packages, questions and description, and taking it down. */
export function GigListingCaseScreen({ id }: { id: string }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("businesses.manage");
  const canOrders = useCan("orders.view");
  const canAudit = useCan("audit.view");
  const [gig, setGig] = useState<ConsoleGig | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useActionKey();

  useEffect(() => {
    let live = true;
    consoleGig(id).then(
      (next) => live && setGig(next),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [id, attempt, onSignedOut]);

  const takeDown = async (reason: string) => {
    setBusy(true);
    try {
      setGig(await takeDownGig(id, reason, key.keyFor(`take-down:${id}:${reason}`)));
      key.settle();
      setOpen(false);
      toast("Gig taken down. The freelancer has been told why. Orders already placed carry on.", "success");
    } catch (err) {
      key.settle(err);
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  const status = gig && GIG_STATUS[gig.status];
  const rating = gig && ratingText(gig.rating);

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <div>
          <ButtonLink href="/admin/gigs" variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
            Gigs
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
        ) : !gig || !status ? (
          <Skeleton height={420} radius={16} />
        ) : (
          <Card as="section" padding="lg" className={styles.page}>
            <GigPhoto photo={gig.photo} title={gig.title} eager />
            <div className={styles.head}>
              <div>
                <h1 className={styles.title}>{gig.title}</h1>
                <p className={styles.muted}>{`${gig.freelancer.name} · ${gig.categoryLabel}`}</p>
              </div>
              <div className={styles.tags}>
                <Tag tone={status.tone}>{status.label}</Tag>
              </div>
            </div>
            {gig.removal && (
              <p className={styles.note} data-tone="danger">
                {`Taken down by Ruxstar on ${date(gig.removal.at)}: ${gig.removal.reason}`}
              </p>
            )}

            <dl className={styles.facts}>
              <Fact label="Photos" value={String(gig.photos.length)} warn={!gig.photos.length} />
              <Fact label="Paid orders" value={String(gig.orders)} />
              {rating && <Fact label="Rating" value={rating} />}
              <Fact label="Published" value={gig.publishedAt ? date(gig.publishedAt) : "Never"} />
              <Fact label="Added" value={date(gig.createdAt)} />
              <Fact label="Changed" value={date(gig.updatedAt)} />
              {gig.missing.length > 0 && <Fact label="Missing" value={gig.missing.join(", ")} warn />}
              <Fact label="Gig id" value={gig.id} />
            </dl>

            <section className={styles.group}>
              <h2 className={styles.subtitle}>Packages</h2>
              <div className={gigs.packages}>
                {sortedPackages(gig.packages).map((p) => (
                  <PackageCard key={p.tier} pack={p} />
                ))}
              </div>
            </section>

            {gig.questions.length > 0 && (
              <section className={styles.group}>
                <h2 className={styles.subtitle}>Questions for customers</h2>
                <ul>
                  {gig.questions.map((q) => (
                    <li key={q.id}>{`${q.text}${q.required ? "" : " (optional)"}`}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className={styles.group}>
              <h2 className={styles.subtitle}>About</h2>
              <p className={gigs.preLine}>{gig.description}</p>
            </section>

            {canManage && gig.status !== "removed" &&
              (open ? (
                <ReasonForm
                  prompt={`Take down ${gig.title}? It leaves the listings for good and can’t be ordered or edited. Orders already placed carry on. The freelancer sees your reason.`}
                  placeholder="For example: this service isn’t allowed on Ruxstar."
                  confirm="Take down"
                  busy={busy}
                  onCancel={() => setOpen(false)}
                  onSubmit={(reason) => void takeDown(reason)}
                />
              ) : (
                <div className={styles.actions}>
                  <Button variant="danger" onClick={() => setOpen(true)}>
                    Take down
                  </Button>
                </div>
              ))}

            <div className={styles.actions}>
              <ButtonLink href={`/admin/freelancers/${gig.freelancer.businessId}`} variant="ghost" icon={<Icon name="briefcase" size={18} />}>
                Open the freelancer
              </ButtonLink>
              {canOrders && (
                <ButtonLink
                  href={`/admin/gig-orders?freelancer=${gig.freelancer.businessId}&label=${encodeURIComponent(gig.freelancer.name)}`}
                  variant="ghost"
                  icon={<Icon name="receipt" size={18} />}
                >
                  Their orders
                </ButtonLink>
              )}
              {gig.status === "live" && (
                <ButtonLink href={`/gigs/${gig.id}`} variant="ghost" icon={<Icon name="share" size={18} />}>
                  See it as customers do
                </ButtonLink>
              )}
              {canAudit && (
                <ButtonLink href={`/admin/audit?target=${gig.id}`} variant="ghost" icon={<Icon name="clock" size={18} />}>
                  History for this gig
                </ButtonLink>
              )}
            </div>
          </Card>
        )}
      </div>
    </Needs>
  );
}
