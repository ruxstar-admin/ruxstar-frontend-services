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
import { addPropertyPhoto, deleteProperty, publishProperty, removePropertyPhoto, vendorProperty, type VendorProperty } from "@/lib/api/stays";
import { depositText, FEATURE_LABEL, foodText, forText, KIND_LABEL, noticeText, perText, plural, pricesText, PROPERTY_STATUS, ROOM_KIND_LABEL } from "@/lib/stays";
import { shrinkPhoto } from "@/lib/photo";
import vendor from "@/components/vendor/vendor.module.css";
import events from "@/components/events/events.module.css";

/** Property photos show 16:9; the API keeps them within 1440 px and up to 10, the first being the cover. */
const PHOTO_SIDE = 1440;
const PHOTO_ASPECT = 16 / 9;
const MAX_PHOTOS = 10;

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

function Dashboard({ property, setProperty, reload, fresh }: { property: VendorProperty; setProperty: (p: VendorProperty) => void; reload: () => void; fresh: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const publishKey = useRef(newIdempotencyKey());
  const status = PROPERTY_STATUS[property.status];
  const draft = property.status === "draft";
  const removed = property.status === "removed";
  const list = `/vendor/businesses/${property.business.id}/properties`;
  const beds = property.rooms.reduce((sum, r) => sum + r.beds, 0);

  const run = async (name: string, action: () => Promise<VendorProperty>) => {
    setBusy(name);
    setFailure(null);
    try {
      setProperty(await action());
    } catch (err) {
      setFailure(err instanceof ApiError ? formError(err).message : "That file is not a photo we can read.");
      if (name === "publish" && !(err instanceof ApiError && err.code === "NETWORK")) publishKey.current = newIdempotencyKey();
      reload();
    } finally {
      setBusy(null);
    }
  };

  const addPhoto = (picked: File) => void run("photo", async () => addPropertyPhoto(property.id, await shrinkPhoto(picked, PHOTO_SIDE, PHOTO_ASPECT)));

  const remove = async () => {
    setBusy("delete");
    try {
      await deleteProperty(property.id);
      router.replace(list);
    } catch (err) {
      setBusy(null);
      setDeleting(false);
      setFailure(formError(err).message);
    }
  };

  return (
    <div className={vendor.page}>
      <Back href={list}>Properties</Back>

      {fresh && draft && (
        <p className={vendor.note}>
          <Icon name="check" size={20} />
          <span>Saved as a draft. Add photos and at least one room, then publish.</span>
        </p>
      )}

      <div className={vendor.head}>
        <div className={vendor.identity}>
          <h1 className={vendor.title}>{property.name}</h1>
          <span className={vendor.muted}>{`${KIND_LABEL[property.kind]} · ${forText(property.for, property.occupants)}`}</span>
          <span className={vendor.muted}>{[property.addressDetail.line, property.addressDetail.area, property.addressDetail.city].filter(Boolean).join(", ")}</span>
          <span className={vendor.muted}>{property.refundRule}</span>
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>

      {property.removal && (
        <p className={vendor.note} data-tone="danger">
          <Icon name="alert" size={20} />
          <span>{`Ruxstar took this property down: ${property.removal.reason} Reservations not moved in yet were refunded in full.`}</span>
        </p>
      )}

      <ul className={vendor.photos} aria-label="Photos">
        {property.photos.map((photo, i) => (
          <li key={photo.id} className={vendor.photo}>
            <img src={photo.url} width={photo.width} height={photo.height} alt={i === 0 ? "Cover photo" : `Photo ${i + 1}`} loading="lazy" decoding="async" />
            {i === 0 && <span className={vendor.coverTag}>Cover</span>}
            {!removed && (
              <button
                type="button"
                className={vendor.photoRemove}
                aria-label={`Remove photo ${i + 1}`}
                disabled={!!busy}
                onClick={() => void run(photo.id, () => removePropertyPhoto(property.id, photo.id))}
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </li>
        ))}
        {!removed && property.photos.length < MAX_PHOTOS && (
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
      <span className={vendor.faint}>{`Up to ${MAX_PHOTOS} photos: rooms, the building, the kitchen. The first is the cover.`}</span>

      {draft && property.missing.length > 0 && (
        <div className={vendor.note}>
          <Icon name="info" size={20} />
          <div>
            <strong>Before you can publish</strong>
            <ul className={events.qList}>
              {property.missing.map((m) => (
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
          <Button size="lg" loading={busy === "publish"} disabled={property.missing.length > 0} onClick={() => void run("publish", () => publishProperty(property.id, publishKey.current))}>
            Publish property
          </Button>
        </div>
      )}

      {!draft && (
        <section className={vendor.card}>
          <dl className={vendor.stats}>
            <div>
              <dt>Staying</dt>
              <dd>{property.staying}</dd>
            </div>
            <div>
              <dt>To move in</dt>
              <dd>{property.upcoming}</dd>
            </div>
            <div>
              <dt>Beds</dt>
              <dd>{beds}</dd>
            </div>
            {property.rating?.average != null && property.rating.count > 0 && (
              <div>
                <dt>Rating</dt>
                <dd>{property.rating.average.toFixed(1)}</dd>
              </div>
            )}
          </dl>
          <span className={vendor.faint}>Your share is paid out after the tenant moves in and the window to raise a problem closes.</span>
        </section>
      )}

      <span className={vendor.muted}>{[foodText(property.food), depositText(property.depositDetail.amount), noticeText(property.noticeDays)].join(" · ")}</span>
      {property.facilities.length > 0 && <span className={vendor.muted}>{`Facilities: ${property.facilities.map((f) => f.name).join(", ")}`}</span>}

      <div className={vendor.spread}>
        <h2 className={vendor.section}>Rooms</h2>
        {!removed && (
          <ButtonLink href={`/vendor/properties/${property.id}/rooms/new`} variant="secondary" icon={<Icon name="plus" size={16} />}>
            Add a room
          </ButtonLink>
        )}
      </div>
      {property.rooms.length ? (
        <ul className={vendor.rows}>
          {property.rooms.map((r) => (
            <li key={r.id}>
              <Link href={`/vendor/properties/${property.id}/rooms/${r.id}`} className={vendor.row}>
                <Icon name="bed" size={20} />
                <span className={vendor.rowText}>
                  <span className={vendor.rowTitle}>{r.name}</span>
                  <span className={vendor.rowLine}>{`${ROOM_KIND_LABEL[r.kind]} · ${plural(r.beds, "bed")}${r.kind === "shared" && r.wholeRoom ? " · whole room too" : ""}`}</span>
                  <span className={vendor.rowLine}>{`${pricesText(r.prices)} ${perText(r.kind)}`}</span>
                  {r.features.length > 0 && <span className={vendor.rowLine}>{r.features.map((f) => FEATURE_LABEL[f]).join(", ")}</span>}
                </span>
                {r.status === "paused" && <Tag>Full</Tag>}
                <Icon name="chevron-right" size={18} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={vendor.muted}>A room has one or more beds. Shared rooms are reserved bed by bed; private rooms whole. Add at least one.</p>
      )}

      <ul className={vendor.rows}>
        {!draft && <Row href={`/beds/${property.id}`} icon="grid" title="Bed map" subtitle="Every bed for the week: free, reserved or moved in. Mark beds full" />}
        {!draft && <Row href={`/beds/${property.id}/reservations`} icon="calendar" title="Reservations" subtitle="Who’s moving in, mark moved in, move-outs and cancelling" />}
        {!draft && <Row href={`/beds/${property.id}/tenants`} icon="users" title="Tenants" subtitle="Who lives here now, with phone numbers and notice" />}
        {!removed && <Row href={`/vendor/properties/${property.id}/edit`} icon="edit" title="Edit details" subtitle="Name, address, food, facilities, rules, deposit and nearby places" />}
        {!draft && <Row href={`/stays/${property.id}`} icon="home" title="See it as tenants do" subtitle="The public page with rooms and reviews" />}
        <Row href={`/vendor/businesses/${property.business.id}/team`} icon="shield" title="Wardens and staff" subtitle="Invite your team and choose what they can do" />
      </ul>

      {deleting ? (
        <section className={vendor.card}>
          <h2 className={vendor.section}>Delete this draft?</h2>
          <p className={vendor.muted}>{`${property.name}, its rooms and photos will be deleted. This can’t be undone.`}</p>
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

/** A PG / hostel property: photos, publishing, rooms with beds and prices, and the way to the bed map and reservations. */
export function ManagePropertyScreen({ id, fresh }: { id: string; fresh: boolean }) {
  const { data, error, reload, setData } = useLoad(() => vendorProperty(id), id);

  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [reload]);

  if (data) return <Dashboard property={data} setProperty={setData} reload={reload} fresh={fresh} />;
  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <Empty title="Property not found">
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
