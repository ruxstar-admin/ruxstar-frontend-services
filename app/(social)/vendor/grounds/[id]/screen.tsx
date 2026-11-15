"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Tag, type IconName } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { addGroundPhoto, deleteGround, publishGround, removeGroundPhoto, vendorGround, type VendorGround } from "@/lib/api/turf";
import { AMENITY_LABEL, GROUND_STATUS, hoursText, pricesText, slotLengthText } from "@/lib/turf";
import { shrinkPhoto } from "@/lib/photo";
import vendor from "@/components/vendor/vendor.module.css";
import events from "@/components/events/events.module.css";

/** Ground photos show 16:9; the API keeps them within 1440 px and up to 8, the first being the cover. */
const PHOTO_SIDE = 1440;
const PHOTO_ASPECT = 16 / 9;
const MAX_PHOTOS = 8;

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

function Dashboard({ ground, setGround, reload, fresh }: { ground: VendorGround; setGround: (g: VendorGround) => void; reload: () => void; fresh: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const publishKey = useRef(newIdempotencyKey());
  const status = GROUND_STATUS[ground.status];
  const draft = ground.status === "draft";
  const removed = ground.status === "removed";
  const list = `/vendor/businesses/${ground.business.id}/grounds`;

  const run = async (name: string, action: () => Promise<VendorGround>) => {
    setBusy(name);
    setFailure(null);
    try {
      setGround(await action());
    } catch (err) {
      setFailure(err instanceof ApiError ? formError(err).message : "That file is not a photo we can read.");
      if (name === "publish" && !(err instanceof ApiError && err.code === "NETWORK")) publishKey.current = newIdempotencyKey();
      reload();
    } finally {
      setBusy(null);
    }
  };

  const addPhoto = (picked: File) => void run("photo", async () => addGroundPhoto(ground.id, await shrinkPhoto(picked, PHOTO_SIDE, PHOTO_ASPECT)));

  const remove = async () => {
    setBusy("delete");
    try {
      await deleteGround(ground.id);
      router.replace(list);
    } catch (err) {
      setBusy(null);
      setDeleting(false);
      setFailure(formError(err).message);
    }
  };

  return (
    <div className={vendor.page}>
      <Back href={list}>Grounds</Back>

      {fresh && draft && (
        <p className={vendor.note}>
          <Icon name="check" size={20} />
          <span>Saved as a draft. Add photos and at least one court, then publish.</span>
        </p>
      )}

      <div className={vendor.head}>
        <div className={vendor.identity}>
          <h1 className={vendor.title}>{ground.name}</h1>
          <span className={vendor.muted}>{`${ground.venue.address}, ${ground.venue.city}`}</span>
          <span className={vendor.muted}>{ground.refundRule}</span>
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>

      {ground.removal && (
        <p className={vendor.note} data-tone="danger">
          <Icon name="alert" size={20} />
          <span>{`Ruxstar took this ground down: ${ground.removal.reason} Every booking still to come was refunded in full.`}</span>
        </p>
      )}

      <ul className={vendor.photos} aria-label="Photos">
        {ground.photos.map((photo, i) => (
          <li key={photo.id} className={vendor.photo}>
            <img src={photo.url} width={photo.width} height={photo.height} alt={i === 0 ? "Cover photo" : `Photo ${i + 1}`} loading="lazy" decoding="async" />
            {i === 0 && <span className={vendor.coverTag}>Cover</span>}
            {!removed && (
              <button
                type="button"
                className={vendor.photoRemove}
                aria-label={`Remove photo ${i + 1}`}
                disabled={!!busy}
                onClick={() => void run(photo.id, () => removeGroundPhoto(ground.id, photo.id))}
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </li>
        ))}
        {!removed && ground.photos.length < MAX_PHOTOS && (
          <li>
            <button type="button" className={vendor.addPhoto} aria-label="Add a photo" disabled={busy === "photo"} onClick={() => file.current?.click()}>
              <Icon name={busy === "photo" ? "clock" : "plus"} size={28} />
            </button>
            <input
              ref={file}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const picked = e.target.files?.[0];
                e.target.value = "";
                if (picked) addPhoto(picked);
              }}
            />
          </li>
        )}
      </ul>
      <span className={vendor.faint}>{`Up to ${MAX_PHOTOS} photos. The first is the cover.`}</span>

      {draft && ground.missing.length > 0 && (
        <div className={vendor.note}>
          <Icon name="info" size={20} />
          <div>
            <strong>Before you can publish</strong>
            <ul className={events.qList}>
              {ground.missing.map((m) => (
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

      {draft && (
        <div className={vendor.actions}>
          <Button size="lg" loading={busy === "publish"} disabled={ground.missing.length > 0} onClick={() => void run("publish", () => publishGround(ground.id, publishKey.current))}>
            Publish ground
          </Button>
        </div>
      )}

      {!draft && (
        <section className={vendor.card}>
          <dl className={vendor.stats}>
            <div>
              <dt>Bookings to come</dt>
              <dd>{ground.upcoming}</dd>
            </div>
            <div>
              <dt>Courts</dt>
              <dd>{ground.courtList.length}</dd>
            </div>
            {ground.rating?.average != null && ground.rating.count > 0 && (
              <div>
                <dt>Rating</dt>
                <dd>{ground.rating.average.toFixed(1)}</dd>
              </div>
            )}
          </dl>
          <span className={vendor.faint}>Your share of each date is paid out after it’s played.</span>
        </section>
      )}

      {ground.amenities.length > 0 && <span className={vendor.muted}>{`At the ground: ${ground.amenities.map((a) => AMENITY_LABEL[a]).join(", ")}`}</span>}

      <div className={vendor.spread}>
        <h2 className={vendor.section}>Courts</h2>
        {!removed && (
          <ButtonLink href={`/vendor/grounds/${ground.id}/courts/new`} variant="secondary" icon={<Icon name="plus" size={16} />}>
            Add a court
          </ButtonLink>
        )}
      </div>
      {ground.courtList.length ? (
        <ul className={vendor.rows}>
          {ground.courtList.map((c) => (
            <li key={c.id}>
              <Link href={`/vendor/grounds/${ground.id}/courts/${c.id}`} className={vendor.row}>
                <Icon name="ball" size={20} />
                <span className={vendor.rowText}>
                  <span className={vendor.rowTitle}>{c.name}</span>
                  <span className={vendor.rowLine}>{`${c.sports.map((s) => s.name).join(", ")} · ${slotLengthText(c.slotMinutes)} slots`}</span>
                  <span className={vendor.rowLine}>{hoursText(c.hours)}</span>
                  <span className={vendor.rowLine}>{pricesText(c.prices, c.slotMinutes)}</span>
                </span>
                {c.status === "paused" && <Tag>Paused</Tag>}
                <Icon name="chevron-right" size={18} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={vendor.muted}>A court is one pitch or box players book by the slot, with its own hours and prices. Add at least one.</p>
      )}

      <ul className={vendor.rows}>
        {!draft && <Row href={`/board/${ground.id}`} icon="grid" title="Today’s board" subtitle="Every court’s slots, block a slot, mark who turned up" />}
        {!draft && <Row href={`/board/${ground.id}/bookings`} icon="calendar" title="Bookings" subtitle="Upcoming and past, with each player’s details" />}
        {!removed && <Row href={`/vendor/grounds/${ground.id}/edit`} icon="edit" title="Edit details" subtitle="Name, address, amenities and refund hours" />}
        {!draft && <Row href={`/grounds/${ground.id}`} icon="ball" title="See it as players do" subtitle="The public page with courts and reviews" />}
        <Row href={`/vendor/businesses/${ground.business.id}/team`} icon="shield" title="Ground staff" subtitle="Invite staff to your team and choose what they can do" />
      </ul>

      {deleting ? (
        <section className={vendor.card}>
          <h2 className={vendor.section}>Delete this draft?</h2>
          <p className={vendor.muted}>{`${ground.name}, its courts and photos will be deleted. This can’t be undone.`}</p>
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
        draft && (
          <div className={vendor.actions}>
            <button type="button" className={vendor.link} data-muted onClick={() => setDeleting(true)}>
              Delete this draft
            </button>
          </div>
        )
      )}
    </div>
  );
}

/** A sports business's ground: photos, publishing, courts with hours and prices, and the way to the board and bookings. */
export function ManageGroundScreen({ id, fresh }: { id: string; fresh: boolean }) {
  const { data, error, reload, setData } = useLoad(() => vendorGround(id), id);

  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [reload]);

  if (data) return <Dashboard ground={data} setGround={setData} reload={reload} fresh={fresh} />;
  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <Empty title="Ground not found">
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
