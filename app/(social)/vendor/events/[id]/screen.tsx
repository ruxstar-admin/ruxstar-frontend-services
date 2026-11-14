"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Tag, type IconName } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Poster } from "@/components/events/EventCard";
import { EventSales } from "@/components/events/EventSales";
import { Back, Failed, Loading, TextArea } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { cancelEvent, deleteEvent, getVendorEvent, publishEvent, setPoster, type VendorEvent } from "@/lib/api/events";
import { EVENT_STATUS, KIND_LABEL, whenLine } from "@/lib/events";
import { shrinkPhoto } from "@/lib/photo";
import vendor from "@/components/vendor/vendor.module.css";
import styles from "@/components/events/events.module.css";

/** Posters are 16:9 on the event card; the API keeps them within 1440 px. */
const POSTER_SIDE = 1440;
const POSTER_ASPECT = 16 / 9;

function Row({ href, icon, title, subtitle }: { href: string; icon: IconName; title: string; subtitle: string }) {
  return (
    <li>
      <Link href={href} className={vendor.row}>
        <Icon name={icon} size={20} />
        <span className={vendor.rowText}>
          <span className={vendor.rowTitle}>{title}</span>
          <span className={vendor.rowLine}>{subtitle}</span>
        </span>
        <Icon name="chevron-right" size={18} />
      </Link>
    </li>
  );
}

function Dashboard({ event, setEvent, reload, fresh }: { event: VendorEvent; setEvent: (e: VendorEvent) => void; reload: () => void; fresh: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const publishKey = useRef(newIdempotencyKey());
  const cancelKey = useRef(newIdempotencyKey());
  const status = EVENT_STATUS[event.status];
  const draft = event.status === "draft";
  const open = event.status === "draft" || event.status === "live";

  const run = async (name: string, action: () => Promise<VendorEvent>) => {
    setBusy(name);
    setFailure(null);
    try {
      setEvent(await action());
      return true;
    } catch (err) {
      setFailure(err instanceof ApiError ? formError(err).message : "That file is not a photo we can read.");
      reload();
      return false;
    } finally {
      setBusy(null);
    }
  };

  const poster = (picked: File) => void run("photo", async () => setPoster(event.id, await shrinkPhoto(picked, POSTER_SIDE, POSTER_ASPECT)));

  const cancel = async () => {
    if (await run("cancel", () => cancelEvent(event.id, reason.trim(), cancelKey.current))) setCancelling(false);
  };

  const remove = async () => {
    setBusy("delete");
    try {
      await deleteEvent(event.id);
      router.replace(`/vendor/businesses/${event.business.id}/events`);
    } catch (err) {
      setBusy(null);
      setDeleting(false);
      setFailure(formError(err).message);
    }
  };

  return (
    <div className={vendor.page}>
      <Back href={`/vendor/businesses/${event.business.id}/events`}>Events</Back>

      {fresh && draft && (
        <p className={vendor.note}>
          <Icon name="check" size={20} />
          <span>Saved as a draft. Add a poster, then publish it to start selling.</span>
        </p>
      )}

      <div className={styles.posterEdit}>
        <Poster photo={event.photo} title={event.title} eager className={styles.poster} />
        {open && (
          <div>
            <input
              ref={file}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const picked = e.target.files?.[0];
                e.target.value = "";
                if (picked) poster(picked);
              }}
            />
            <Button variant="secondary" icon={<Icon name="image" size={16} />} loading={busy === "photo"} onClick={() => file.current?.click()}>
              {event.photo ? "Change poster" : "Add a poster"}
            </Button>
          </div>
        )}
      </div>

      <div className={vendor.head}>
        <div className={vendor.identity}>
          <h1 className={vendor.title}>{event.title}</h1>
          <span className={vendor.muted}>{`${KIND_LABEL[event.kind]} · ${whenLine(event.startsAt, event.endsAt)}`}</span>
          <span className={vendor.muted}>{event.online ? "Online" : [event.venue?.name, event.venue?.city].filter(Boolean).join(", ")}</span>
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>

      {event.cancellation && (
        <p className={vendor.note} data-tone="danger">
          <Icon name="alert" size={20} />
          <span>
            {`${event.cancellation.by === "staff" ? "Ruxstar took this event down" : "You cancelled this event"}: ${event.cancellation.reason} Everyone who booked is refunded in full.`}
          </span>
        </p>
      )}

      {draft && event.missing.length > 0 && (
        <div className={vendor.note}>
          <Icon name="info" size={20} />
          <div>
            <strong>Before you can publish</strong>
            <ul className={styles.qList}>
              {event.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {failure && (
        <p className={vendor.error} role="alert">
          {failure}
        </p>
      )}

      {draft ? (
        <div className={vendor.actions}>
          <Button
            size="lg"
            loading={busy === "publish"}
            disabled={event.missing.length > 0}
            onClick={() => void run("publish", () => publishEvent(event.id, publishKey.current))}
          >
            Publish and start selling
          </Button>
        </div>
      ) : (
        event.status === "live" &&
        !event.online && (
          <div className={vendor.actions}>
            <ButtonLink href={`/gate/${event.id}`} size="lg" icon={<Icon name="ticket" size={18} />}>
              Scan tickets
            </ButtonLink>
          </div>
        )
      )}

      <EventSales event={event} shareLabel="Your share" />

      <ul className={vendor.rows}>
        {!draft && <Row href={`/vendor/events/${event.id}/bookings`} icon="users" title="Bookings" subtitle="Who booked, their answers, and who came in" />}
        {open && <Row href={`/vendor/events/${event.id}/edit`} icon="edit" title="Edit details" subtitle="Name, time, venue, ticket types and questions" />}
        {event.status === "live" && !event.online && (
          <Row href={`/vendor/businesses/${event.business.id}/team`} icon="shield" title="Gate keepers" subtitle="Invite people who only scan tickets" />
        )}
      </ul>

      {cancelling ? (
        <section className={vendor.card}>
          <h2 className={vendor.section}>Cancel this event?</h2>
          <p className={vendor.muted}>
            {event.counts.tickets
              ? `All ${event.counts.tickets} tickets are cancelled and everyone gets a full refund, platform fee included. This can’t be undone.`
              : "It comes off sale for good. This can’t be undone."}
          </p>
          <TextArea label="Tell people why" value={reason} onChange={setReason} max={300} placeholder="e.g. Heavy rain is forecast" />
          <div className={vendor.actions}>
            <Button variant="danger" loading={busy === "cancel"} disabled={reason.trim().length < 5} onClick={() => void cancel()}>
              Cancel the event
            </Button>
            <Button variant="ghost" disabled={busy === "cancel"} onClick={() => setCancelling(false)}>
              Keep it
            </Button>
          </div>
        </section>
      ) : deleting ? (
        <section className={vendor.card}>
          <h2 className={vendor.section}>Delete this draft?</h2>
          <p className={vendor.muted}>{`${event.title} will be deleted. This can’t be undone.`}</p>
          <div className={vendor.actions}>
            <Button variant="danger" loading={busy === "delete"} onClick={() => void remove()}>
              Delete
            </Button>
            <Button variant="ghost" disabled={busy === "delete"} onClick={() => setDeleting(false)}>
              Keep it
            </Button>
          </div>
        </section>
      ) : (
        <div className={vendor.actions}>
          {event.status === "live" && (
            <button type="button" className={vendor.link} data-muted onClick={() => setCancelling(true)}>
              Cancel this event
            </button>
          )}
          {draft && (
            <button type="button" className={vendor.link} data-muted onClick={() => setDeleting(true)}>
              Delete this draft
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** An organiser's event: poster, publishing, sales by ticket type, check-ins, and cancelling. Same as the app. */
export function ManageEventScreen({ id, fresh }: { id: string; fresh: boolean }) {
  const { data, error, reload, setData } = useLoad(() => getVendorEvent(id), id);

  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [reload]);

  if (data) return <Dashboard event={data} setEvent={setData} reload={reload} fresh={fresh} />;
  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <Empty title="Event not found">
          <ButtonLink href="/vendor/businesses" variant="secondary">
            Businesses
          </ButtonLink>
        </Empty>
      );
    }
    return <Failed error={error} onRetry={reload} />;
  }
  return <Loading rows={5} />;
}
