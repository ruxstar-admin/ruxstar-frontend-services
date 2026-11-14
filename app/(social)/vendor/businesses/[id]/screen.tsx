"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, ButtonLink, Icon, Segmented, Tag, type IconName } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { shrinkPhoto } from "@/lib/photo";
import { contactSupport } from "@/lib/support";
import { ratingLine } from "@/lib/api/reviews";
import { MODULE_LABEL } from "@/lib/api/shops";
import { getWork, type TeamPermission } from "@/lib/api/team";
import { addressOf, areaLine, canOpen, deleteBusiness, listOf, MISSING_LABEL, publishBusiness, shopDesk, statusOf, vendorCatalog, type Business } from "@/lib/api/vendor";
import styles from "@/components/vendor/vendor.module.css";

/** Matches the API's cap. */
const MAX_PHOTOS = 3;
/** The API keeps business photos within 1440 px, like post photos. */
const UPLOAD_SIDE = 1440;
const OPEN_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
] as const;

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd data-empty={value ? undefined : true}>{value ?? "Not added"}</dd>
    </div>
  );
}

/** `done` marks a setup step; leave it out for places that are never "done". */
function Tile({ href, icon, title, subtitle, done, disabled }: { href: string; icon: IconName; title: string; subtitle: string; done?: boolean; disabled?: boolean }) {
  const step = done !== undefined;
  return (
    <li>
      <Link
        href={href}
        className={styles.tile}
        data-todo={(step && !done) || undefined}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        aria-label={step ? `${title}, ${done ? "done" : "to do"}` : undefined}
      >
        <span className={styles.tileTop}>
          <span className={styles.tileIcon}>
            <Icon name={icon} size={24} />
          </span>
          {step && (done ? <Icon name="check" size={18} className={styles.done} /> : <span className={styles.tileTodo}>To do</span>)}
        </span>
        <span className={styles.tileTitle}>{title}</span>
        <span className={styles.tileLine}>{subtitle}</span>
      </Link>
    </li>
  );
}

function Details({
  id,
  team,
  can,
  business,
  onChange,
}: {
  id: string;
  team: boolean;
  can: (permission: TeamPermission) => boolean;
  business: Business;
  onChange: (b: Business) => void;
}) {
  const router = useRouter();
  const onSignedOut = useOnSignedOut();
  const catalog = useLoad(() => vendorCatalog());
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const desk = shopDesk(team);
  const home = desk.home(id);
  const b = business;

  const category = catalog.data?.categories.find((c) => c.module === b.module);
  const type = category?.types.find((t) => t.id === b.type);
  const typeLabel = type ? `${category!.label} · ${type.label}` : MODULE_LABEL[b.module];
  const status = statusOf(b);

  /** `before` is put back when the action fails. */
  const run = async (name: string, action: () => Promise<Business>, before?: Business) => {
    setBusy(name);
    setFailure(null);
    try {
      onChange(await action());
    } catch (err) {
      if (before) onChange(before);
      if (!onSignedOut(err)) setFailure(err instanceof ApiError ? formError(err).message : "That file is not a photo we can read.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("delete");
    try {
      await deleteBusiness(id);
      router.replace("/vendor/businesses");
    } catch (err) {
      setBusy(null);
      setConfirmDelete(false);
      if (!onSignedOut(err)) setFailure(formError(err).message);
    }
  };

  const editable = !b.suspension;
  const photosEditable = editable && can("shop.details");
  const catalogRows = !!b.pod && editable && can("shop.catalog");

  return (
    <div className={styles.page}>
      {team ? <Back href={`/work/${id}`}>{b.name}</Back> : <Back href="/vendor/businesses">Businesses</Back>}
      <div className={styles.head}>
        <div className={styles.identity}>
          <h1 className={styles.name}>{b.name}</h1>
          <p className={styles.muted}>{typeLabel}</p>
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>

      {b.suspension ? (
        <p className={styles.note} data-tone="danger">
          <Icon name="alert" size={20} />
          <span>
            <strong>On hold by Ruxstar: </strong>
            {b.suspension.reason} Customers can&apos;t see it and it can&apos;t be changed.{" "}
            <Link href={team ? contactSupport("business") : contactSupport("business", { type: "business", id, label: b.name })}>Message support</Link> to
            continue.
          </span>
        </p>
      ) : !b.moduleLive ? (
        <p className={styles.note}>
          <Icon name="info" size={20} />
          <span>{`Ruxstar has paused ${MODULE_LABEL[b.module].toLowerCase()} for now. Customers can't order until it is back.`}</span>
        </p>
      ) : null}

      {team && canOpen(b) && can("shop.open") && (
        <div className={styles.openCard} data-open={b.open || undefined}>
          <Segmented
            label="Open or closed"
            options={OPEN_OPTIONS}
            value={b.open ? "open" : "closed"}
            onChange={(next) => {
              const open = next === "open";
              if (busy || open === b.open) return;
              onChange({ ...b, open });
              void run("open", () => desk.setOpen(id, open), b);
            }}
          />
          <p className={styles.muted}>{b.open ? "Customers can order and book now." : "Customers still see it, marked closed."}</p>
        </div>
      )}

      <ul className={styles.photos} aria-label="Photos">
        {b.photos.map((photo, i) => (
          <li key={photo.id} className={styles.photo}>
            <img src={photo.url} alt={i === 0 ? "Cover photo" : `Photo ${i + 1}`} />
            {i === 0 && <span className={styles.coverTag}>Cover</span>}
            {photosEditable && (
              <button
                type="button"
                className={styles.photoRemove}
                aria-label="Remove photo"
                disabled={!!busy}
                onClick={() => void run(photo.id, () => desk.removePhoto(id, photo.id))}
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </li>
        ))}
        {photosEditable && b.photos.length < MAX_PHOTOS && (
          <li>
            <button type="button" className={styles.addPhoto} aria-label="Add a photo" disabled={busy === "photo"} onClick={() => fileInput.current?.click()}>
              <Icon name={busy === "photo" ? "clock" : "plus"} size={28} />
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void run("photo", async () => desk.addPhoto(id, await shrinkPhoto(file, UPLOAD_SIDE)));
              }}
            />
          </li>
        )}
      </ul>
      {editable && can("shop.details") && (
        <ButtonLink href={`${home}/details`} variant="secondary" icon={<Icon name="edit" size={16} />}>
          Edit details
        </ButtonLink>
      )}

      {(catalogRows || !team) && (
        <ul className={styles.tiles}>
          {catalogRows && b.pod && (
            <>
              <Tile
                href={`${home}/products`}
                icon="stack"
                title="Products & delivery"
                subtitle={b.pod.products.length ? `${b.pod.products.length} products · ${areaLine(b.pod)}` : "Choose what you print and where you deliver"}
                done={!b.missing.includes("products") && !b.missing.includes("area")}
              />
              <Tile
                href={`${home}/prices`}
                icon="tag"
                title="Prices"
                subtitle={
                  !b.pod.products.length
                    ? "After you choose products"
                    : b.pod.unpriced.length
                      ? `${b.pod.unpriced.length} product${b.pod.unpriced.length === 1 ? "" : "s"} need a price`
                      : "Every product has a price"
                }
                done={b.pod.products.length > 0 && !b.missing.includes("pricing")}
                disabled={!b.pod.products.length}
              />
            </>
          )}
          {!team && b.pod && editable && (
            <Tile href={`/vendor/businesses/${id}/team`} icon="users" title="Team" subtitle="Invite people to help with orders, the shop and posts" />
          )}
          {!team && b.pod && b.status === "live" && <Tile href={`/vendor/businesses/${id}/reviews`} icon="star" title="Reviews" subtitle={ratingLine(b.rating)} />}
          {!team && <Tile href={`/vendor/businesses/${id}/activity`} icon="clock" title="Activity" subtitle="Who did what: you, your team, customers and Ruxstar" />}
        </ul>
      )}

      <section className={styles.card}>
        <dl className={styles.facts}>
          <Fact label="About" value={b.description} />
          <Fact label="Phone" value={b.phone} />
          <Fact label="Location" value={addressOf(b.location)} />
          <Fact label="GSTIN" value={b.gstin ? `${b.gstin.number}${b.gstin.legalName ? ` · ${b.gstin.legalName}` : ""}` : null} />
        </dl>
      </section>

      {b.status === "draft" && editable && !team && (
        <section className={styles.form}>
          <p className={styles.muted}>
            {b.missing.length ? `To publish, add ${listOf(b.missing.map((m) => MISSING_LABEL[m]))}.` : "All set. Publishing lets customers find it and opens it straight away."}
          </p>
          {confirmDelete ? (
            <div className={styles.note} data-tone="danger">
              <Icon name="trash" size={20} />
              <div className={styles.form}>
                <span>
                  <strong>Delete this draft?</strong> {b.name} and its photos will be deleted. This can&apos;t be undone.
                </span>
                <div className={styles.actions}>
                  <Button variant="danger" loading={busy === "delete"} onClick={() => void remove()}>
                    Delete
                  </Button>
                  <Button variant="ghost" disabled={busy === "delete"} onClick={() => setConfirmDelete(false)}>
                    Keep it
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.actions}>
              <Button
                size="lg"
                loading={busy === "publish"}
                disabled={b.missing.length > 0 || !b.moduleLive}
                onClick={() => void run("publish", () => publishBusiness(id))}
              >
                Publish
              </Button>
              <button type="button" className={styles.link} data-muted onClick={() => setConfirmDelete(true)}>
                Delete this draft
              </button>
            </div>
          )}
        </section>
      )}

      {failure && (
        <p className={styles.error} role="alert">
          {failure}
        </p>
      )}
    </div>
  );
}

/**
 * One business: photos, details, publishing, and whether it is open. Same as the app. `team` opens it from Work, where `id`
 * is the place there and only what the owner allowed shows; publishing, deleting and the team stay with the owner.
 */
export function BusinessScreen({ id, team = false }: { id: string; team?: boolean }) {
  const { data, error, reload, setData } = useLoad(() => shopDesk(team).get(id), id);
  const place = useLoad(
    async (): Promise<{ permissions: TeamPermission[] }> => ({
      permissions: team ? ((await getWork()).places.find((p) => p.id === id)?.permissions ?? []) : [],
    }),
    id,
  );
  const can = (permission: TeamPermission) => !team || !!place.data?.permissions.includes(permission);
  if (data && place.data) return <Details id={id} team={team} can={can} business={data} onChange={setData} />;
  const failed = error ?? place.error;
  if (failed) {
    if (failed instanceof ApiError && (failed.status === 404 || (team && failed.status === 403))) {
      return (
        <Empty title={team ? "Not open to you" : "Business not found"}>
          {team && <p>{failed.message}</p>}
          <ButtonLink href={team ? `/work/${id}` : "/vendor/businesses"} variant="secondary">
            {team ? "Back to Work" : "Businesses"}
          </ButtonLink>
        </Empty>
      );
    }
    return (
      <Failed
        error={failed}
        onRetry={() => {
          if (error) reload();
          if (place.error) place.reload();
        }}
      />
    );
  }
  return <Loading rows={4} />;
}
