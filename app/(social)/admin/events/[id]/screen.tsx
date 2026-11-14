"use client";

import { useEffect, useRef, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, ReasonForm, date, styles } from "@/components/admin/parts";
import { EventSales } from "@/components/events/EventSales";
import { Poster } from "@/components/events/EventCard";
import { useOnSignedOut } from "@/components/social/session";
import { Button, ButtonLink, Card, Icon, Skeleton, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { newIdempotencyKey } from "@/lib/api/client";
import { getStaffEvent, takeDownEvent, type VendorEvent } from "@/lib/api/events";
import { money } from "@/lib/api/shops";
import { EVENT_STATUS, KIND_LABEL, whenLine } from "@/lib/events";
import { ago } from "@/lib/time";
import eventStyles from "@/components/events/events.module.css";

/** Drafts and events still to come can be taken down; cancelled and ended ones can't. */
function TakeDown({ event, onDone }: { event: VendorEvent; onDone: (next: VendorEvent, message: string) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("businesses.manage");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());
  if (!canManage || (event.status !== "draft" && event.status !== "live")) return null;

  const tickets = event.counts.tickets;
  const message =
    event.status === "draft"
      ? "The draft is cancelled for good and the organiser can’t publish it. They see your reason. This can’t be undone."
      : tickets
        ? `It comes off sale for good. All ${tickets} ${tickets === 1 ? "ticket is" : "tickets are"} cancelled and everyone gets a full refund, platform fee included. The organiser and every ticket holder see your reason. This can’t be undone.`
        : "It comes off sale for good. Nobody has booked yet. The organiser sees your reason. This can’t be undone.";

  async function takeDown(reason: string) {
    setBusy(true);
    try {
      const next = await takeDownEvent(event.id, reason, key.current);
      key.current = newIdempotencyKey();
      setOpen(false);
      onDone(
        next,
        tickets
          ? "Event taken down. Everyone who booked is being refunded in full, and they and the organiser have been told why."
          : "Event taken down. The organiser has been told why.",
      );
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  if (open) {
    return (
      <ReasonForm
        prompt={`Take down ${event.title}? ${message}`}
        placeholder="For example: this event breaks Ruxstar’s rules on ticket resale."
        confirm={tickets && event.status === "live" ? "Take down and refund everyone" : "Take down"}
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

/** One event for the Ruxstar team: what's on sale, who runs it, how it's selling, and taking it down. Same as the app. */
export function EventCaseScreen({ id }: { id: string }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canAudit = useCan("audit.view");
  const [event, setEvent] = useState<VendorEvent | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    getStaffEvent(id).then(
      (next) => live && setEvent(next),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [id, attempt, onSignedOut]);

  const status = event ? EVENT_STATUS[event.status] : null;

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <div>
          <ButtonLink href="/admin/events" variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
            Events
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
        ) : !event || !status ? (
          <Skeleton height={420} radius={16} />
        ) : (
          <Card as="section" padding="lg" className={styles.page}>
            <Poster photo={event.photo} title={event.title} className={eventStyles.poster} />
            <div className={styles.head}>
              <div>
                <h1 className={styles.title}>{event.title}</h1>
                <p className={styles.muted}>{`${KIND_LABEL[event.kind]} · ${whenLine(event.startsAt, event.endsAt)}`}</p>
              </div>
              <div className={styles.tags}>
                <Tag tone={status.tone}>{status.label}</Tag>
              </div>
            </div>

            {event.cancellation && (
              <p className={styles.note} data-tone="danger">
                {`${event.cancellation.by === "staff" ? "Taken down by Ruxstar" : "Cancelled by the organiser"} ${ago(event.cancellation.at)}: ${event.cancellation.reason}`}
              </p>
            )}

            <EventSales event={event} shareLabel="Organiser’s share" />

            <dl className={styles.facts}>
              <Fact label="Organiser" value={event.business.name} />
              <Fact label="Where" value={event.online ? "Online" : [event.venue?.name, event.venue?.address, event.venue?.city].filter(Boolean).join(", ")} />
              {event.online && event.onlineLink && <Fact label="Meeting link" value={event.onlineLink} />}
              <Fact label="Ticket sales" value={money(event.money.sales)} />
              <Fact label="Commission" value={`${event.money.commissionBps / 100}%`} />
              <Fact label="Refunds" value={event.refunds === "standard" ? "Full refund until the cut-off" : "No refunds"} />
              {event.teamSize && <Fact label="Team entries" value={`${event.teamSize.min} to ${event.teamSize.max} players`} />}
              <Fact label="Questions" value={event.questions.length ? event.questions.map((q) => q.label).join(", ") : "None"} />
              {event.status === "draft" && event.missing.length > 0 && <Fact label="Missing to publish" value={event.missing.join(", ")} warn />}
              <Fact label="Published" value={event.publishedAt ? date(event.publishedAt) : "Not yet"} />
              <Fact label="Created" value={date(event.createdAt)} />
              <Fact label="Event id" value={event.id} />
            </dl>

            {event.description && <p className={styles.text}>{event.description}</p>}

            <TakeDown
              event={event}
              onDone={(next, message) => {
                setEvent(next);
                toast(message, "success");
              }}
            />

            <div className={styles.actions}>
              <ButtonLink href={`/admin/businesses/${event.business.id}`} variant="ghost" icon={<Icon name="store" size={18} />}>
                Open the organiser’s business
              </ButtonLink>
              {canAudit && (
                <ButtonLink href={`/admin/audit?target=${event.id}`} variant="ghost" icon={<Icon name="clock" size={18} />}>
                  History for this event
                </ButtonLink>
              )}
            </div>
          </Card>
        )}
      </div>
    </Needs>
  );
}
