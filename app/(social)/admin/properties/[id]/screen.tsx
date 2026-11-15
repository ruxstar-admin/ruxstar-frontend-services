"use client";

import { useEffect, useRef, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, ReasonForm, date, styles } from "@/components/admin/parts";
import { PropertyPhoto } from "@/components/stays/PropertyCard";
import { useOnSignedOut } from "@/components/social/session";
import { Button, ButtonLink, Card, Icon, Skeleton, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { consoleProperty, takeDownProperty, type ConsolePropertyDetail } from "@/lib/api/stays";
import { depositLine, FEATURE_LABEL, foodText, forText, KIND_LABEL, noticeText, plural, pricesText, PROPERTY_STATUS, ROOM_KIND_LABEL } from "@/lib/stays";
import { ago } from "@/lib/time";
import eventStyles from "@/components/events/events.module.css";

/** Drafts and live properties can be taken down; taken-down ones can't again. */
function TakeDown({ detail, onDone }: { detail: ConsolePropertyDetail; onDone: (next: ConsolePropertyDetail, message: string) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("businesses.manage");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());
  const { property, reservations } = detail;
  if (!canManage || property.status === "removed") return null;

  const message = reservations.upcoming
    ? `Every reservation not moved in yet is cancelled and refunded in full, platform fee included (${plural(reservations.upcoming, "reservation")}). Tenants already living there stay as they are. It can’t take reservations again. The owner and every tenant refunded see your reason. This can’t be undone.`
    : "It can’t take reservations again. Nobody is waiting to move in. The owner sees your reason. This can’t be undone.";

  async function takeDown(reason: string) {
    setBusy(true);
    try {
      const done = await takeDownProperty(property.id, reason, key.current);
      key.current = newIdempotencyKey();
      setOpen(false);
      onDone(
        { ...detail, property: done.property, reservations: { ...reservations, upcoming: 0 } },
        done.refunded
          ? `Property taken down. ${done.refunded} ${done.refunded === 1 ? "reservation is" : "reservations are"} being refunded, and everyone has been told why.`
          : "Property taken down. The owner has been told why.",
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
        prompt={`Take down ${property.name}? ${message}`}
        placeholder="For example: the photos don’t show a real property."
        confirm={reservations.upcoming ? "Take down and refund" : "Take down"}
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

/** One PG or hostel for the Ruxstar team: who runs it, its rooms and prices, its reservations, and taking it down. */
export function PropertyCaseScreen({ id }: { id: string }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canAudit = useCan("audit.view");
  const canOrders = useCan("orders.view");
  const [detail, setDetail] = useState<ConsolePropertyDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    consoleProperty(id).then(
      (next) => live && setDetail(next),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [id, attempt, onSignedOut]);

  const property = detail?.property;
  const status = property ? PROPERTY_STATUS[property.status] : null;
  const r = detail?.reservations;

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <div>
          <ButtonLink href="/admin/properties" variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
            PGs & hostels
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
        ) : !detail || !property || !status || !r ? (
          <Skeleton height={420} radius={16} />
        ) : (
          <Card as="section" padding="lg" className={styles.page}>
            <PropertyPhoto photo={property.photos[0] ?? null} name={property.name} className={eventStyles.poster} />
            <div className={styles.head}>
              <div>
                <h1 className={styles.title}>{property.name}</h1>
                <p className={styles.muted}>{`${KIND_LABEL[property.kind]} · ${forText(property.for, property.occupants)}`}</p>
              </div>
              <div className={styles.tags}>
                <Tag tone={status.tone}>{status.label}</Tag>
              </div>
            </div>

            {property.removal && <p className={styles.note} data-tone="danger">{`Taken down by Ruxstar ${ago(property.removal.at)}: ${property.removal.reason}`}</p>}

            <dl className={styles.facts}>
              <Fact label="Business" value={property.business.name} />
              <Fact label="Where" value={[property.addressDetail.line, property.addressDetail.area, property.addressDetail.city, property.addressDetail.pincode].filter(Boolean).join(", ")} />
              <Fact label="Waiting to move in" value={String(r.upcoming)} />
              <Fact label="Staying now" value={String(r.staying)} />
              <Fact label="Reservations in all" value={`${r.total} · ${r.cancelled} cancelled`} />
              <Fact label="Problems raised" value={String(r.objections)} warn={r.objections > 0} />
              <Fact label="Refunds" value={property.refundRule} />
              <Fact label="Food" value={foodText(property.food)} />
              <Fact label="Deposit" value={depositLine(property.depositDetail)} />
              <Fact label="Notice" value={noticeText(property.noticeDays)} />
              <Fact label="Facilities" value={property.facilities.map((f) => f.name).join(", ") || "None listed"} />
              <Fact label="Photos" value={String(property.photos.length)} />
              {property.status === "draft" && property.missing.length > 0 && <Fact label="Missing to publish" value={property.missing.join(", ")} warn />}
              <Fact label="Published" value={property.publishedAt ? date(property.publishedAt) : "Not yet"} />
              <Fact label="Property id" value={property.id} />
            </dl>

            {property.rooms.length > 0 && (
              <section className={styles.group}>
                <h2 className={styles.subtitle}>{`Rooms · ${property.rooms.length}`}</h2>
                <ul className={styles.list}>
                  {property.rooms.map((room) => (
                    <li key={room.id} className={styles.item}>
                      <div className={styles.row}>
                        <span className={styles.whoRow}>
                          <span className={styles.name}>{room.name}</span>
                          <span className={`${styles.muted} ${styles.line}`}>
                            {[ROOM_KIND_LABEL[room.kind], room.kind === "shared" ? plural(room.beds, "bed") : null, ...room.features.map((f) => FEATURE_LABEL[f])].filter(Boolean).join(" · ")}
                          </span>
                          <span className={`${styles.muted} ${styles.line}`}>{pricesText(room.prices)}</span>
                        </span>
                        {room.status === "paused" && (
                          <span className={styles.tags}>
                            <Tag>Marked full</Tag>
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {property.description && <p className={styles.text}>{property.description}</p>}

            <TakeDown
              detail={detail}
              onDone={(next, message) => {
                setDetail(next);
                toast(message, "success");
              }}
            />

            <div className={styles.actions}>
              <ButtonLink href={`/admin/businesses/${property.business.id}`} variant="ghost" icon={<Icon name="store" size={18} />}>
                Open the business
              </ButtonLink>
              {property.status === "live" && (
                <ButtonLink href={`/stays/${property.id}`} variant="ghost" icon={<Icon name="bed" size={18} />}>
                  See it as tenants do
                </ButtonLink>
              )}
              {canOrders && r.objections > 0 && (
                <ButtonLink href="/admin/objections" variant="ghost" icon={<Icon name="flag" size={18} />}>
                  Problems raised by tenants
                </ButtonLink>
              )}
              {canAudit && (
                <ButtonLink href={`/admin/audit?target=${property.id}`} variant="ghost" icon={<Icon name="clock" size={18} />}>
                  History for this property
                </ButtonLink>
              )}
            </div>
          </Card>
        )}
      </div>
    </Needs>
  );
}
