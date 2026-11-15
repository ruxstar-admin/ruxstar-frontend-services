"use client";

import { useEffect, useRef, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, ReasonForm, date, styles } from "@/components/admin/parts";
import { GroundPhoto } from "@/components/turf/GroundCard";
import { useOnSignedOut } from "@/components/social/session";
import { Button, ButtonLink, Card, Icon, Skeleton, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { consoleGround, takeDownGround, type ConsoleGroundDetail } from "@/lib/api/turf";
import { AMENITY_LABEL, GROUND_STATUS, hoursText, pricesText, slotLengthText } from "@/lib/turf";
import { ago } from "@/lib/time";
import eventStyles from "@/components/events/events.module.css";

/** Drafts and live grounds can be taken down; taken-down ones can't again. */
function TakeDown({ detail, onDone }: { detail: ConsoleGroundDetail; onDone: (next: ConsoleGroundDetail, message: string) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("businesses.manage");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());
  const { ground, bookings } = detail;
  if (!canManage || ground.status === "removed") return null;

  const message = bookings.upcoming
    ? `Every date still to come is cancelled and refunded in full, platform fee included (${bookings.upcoming} ${bookings.upcoming === 1 ? "booking" : "bookings"}). It can’t take bookings again. The owner and every player refunded see your reason. This can’t be undone.`
    : "It can’t take bookings again. Nobody has a booking to come. The owner sees your reason. This can’t be undone.";

  async function takeDown(reason: string) {
    setBusy(true);
    try {
      const done = await takeDownGround(ground.id, reason, key.current);
      key.current = newIdempotencyKey();
      setOpen(false);
      onDone(
        { ...detail, ground: done.ground, bookings: { ...bookings, upcoming: 0 } },
        done.refunded ? `Ground taken down. ${done.refunded} ${done.refunded === 1 ? "booking is" : "bookings are"} being refunded, and everyone has been told why.` : "Ground taken down. The owner has been told why.",
      );
    } catch (err) {
      if (!keepIdempotencyKey(err)) key.current = newIdempotencyKey();
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  if (open) {
    return (
      <ReasonForm
        prompt={`Take down ${ground.name}? ${message}`}
        placeholder="For example: the photos don’t show a real ground."
        confirm={bookings.upcoming ? "Take down and refund" : "Take down"}
        busy={busy}
        onCancel={() => setOpen(false)}
        onSubmit={(reason) => void takeDown(reason)}
      />
    );
  }

  return (
    <div className={styles.actions}>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Take down
      </Button>
    </div>
  );
}

/** One ground for the Ruxstar team: who runs it, its courts and prices, its bookings, and taking it down. Same as the app. */
export function GroundCaseScreen({ id }: { id: string }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canAudit = useCan("audit.view");
  const [detail, setDetail] = useState<ConsoleGroundDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    consoleGround(id).then(
      (next) => live && setDetail(next),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [id, attempt, onSignedOut]);

  const ground = detail?.ground;
  const status = ground ? GROUND_STATUS[ground.status] : null;

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <div>
          <ButtonLink href="/admin/grounds" variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
            Grounds
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
        ) : !detail || !ground || !status ? (
          <Skeleton height={420} radius={16} />
        ) : (
          <Card as="section" padding="lg" className={styles.page}>
            <GroundPhoto photo={ground.photos[0] ?? null} name={ground.name} className={eventStyles.poster} />
            <div className={styles.head}>
              <div>
                <h1 className={styles.title}>{ground.name}</h1>
                <p className={styles.muted}>{ground.sports.map((s) => s.name).join(", ") || "No sports yet"}</p>
              </div>
              <div className={styles.tags}>
                <Tag tone={status.tone}>{status.label}</Tag>
              </div>
            </div>

            {ground.removal && <p className={styles.note} data-tone="danger">{`Taken down by Ruxstar ${ago(ground.removal.at)}: ${ground.removal.reason}`}</p>}

            <dl className={styles.facts}>
              <Fact label="Business" value={ground.business.name} />
              <Fact label="Where" value={[ground.venue.address, ground.venue.city, ground.venue.pincode].filter(Boolean).join(", ")} />
              <Fact label="Bookings to come" value={String(detail.bookings.upcoming)} />
              <Fact label="Bookings in all" value={`${detail.bookings.total} · ${detail.bookings.cancelled} cancelled`} />
              <Fact label="Refunds" value={ground.refundRule} />
              <Fact label="Amenities" value={ground.amenities.map((a) => AMENITY_LABEL[a]).join(", ") || "None listed"} />
              <Fact label="Photos" value={String(ground.photos.length)} />
              {ground.status === "draft" && ground.missing.length > 0 && <Fact label="Missing to publish" value={ground.missing.join(", ")} warn />}
              <Fact label="Published" value={ground.publishedAt ? date(ground.publishedAt) : "Not yet"} />
              <Fact label="Ground id" value={ground.id} />
            </dl>

            {ground.courtList.length > 0 && (
              <section className={styles.group}>
                <h2 className={styles.subtitle}>{`Courts · ${ground.courtList.length}`}</h2>
                <ul className={styles.list}>
                  {ground.courtList.map((c) => (
                    <li key={c.id} className={styles.item}>
                      <div className={styles.row}>
                        <span className={styles.whoRow}>
                          <span className={styles.name}>{c.name}</span>
                          <span className={`${styles.muted} ${styles.line}`}>{`${c.sports.map((s) => s.name).join(", ")} · ${slotLengthText(c.slotMinutes)} slots`}</span>
                          <span className={`${styles.muted} ${styles.line}`}>{hoursText(c.hours)}</span>
                          <span className={`${styles.muted} ${styles.line}`}>{pricesText(c.prices, c.slotMinutes)}</span>
                        </span>
                        {c.status === "paused" && (
                          <span className={styles.tags}>
                            <Tag>Paused</Tag>
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {ground.description && <p className={styles.text}>{ground.description}</p>}

            <TakeDown
              detail={detail}
              onDone={(next, message) => {
                setDetail(next);
                toast(message, "success");
              }}
            />

            <div className={styles.actions}>
              <ButtonLink href={`/admin/businesses/${ground.business.id}`} variant="ghost" icon={<Icon name="store" size={18} />}>
                Open the business
              </ButtonLink>
              {ground.status === "live" && (
                <ButtonLink href={`/grounds/${ground.id}`} variant="ghost" icon={<Icon name="ball" size={18} />}>
                  See it as players do
                </ButtonLink>
              )}
              {canAudit && (
                <ButtonLink href={`/admin/audit?target=${ground.id}`} variant="ghost" icon={<Icon name="clock" size={18} />}>
                  History for this ground
                </ButtonLink>
              )}
            </div>
          </Card>
        )}
      </div>
    </Needs>
  );
}
