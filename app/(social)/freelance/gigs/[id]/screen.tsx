"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { PhotoGrid } from "@/components/gigs/fields";
import { loadGigsRules } from "@/components/gigs/use-gigs";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { addGigPhoto, deleteGig, myGig, pauseGig, publishGig, removeGigPhoto, type GigPhoto, type MyGig } from "@/lib/api/gigs";
import { money } from "@/lib/api/shops";
import { deliveryLine, GIG_STATUS, plural, sortedPackages } from "@/lib/gigs";
import { shrinkPhoto } from "@/lib/photo";
import vendor from "@/components/vendor/vendor.module.css";
import events from "@/components/events/events.module.css";

/** Gig photos show 16:9 and are kept within 1440 px, the first being the cover. */
const PHOTO_SIDE = 1440;
const PHOTO_ASPECT = 16 / 9;

type Busy = "photo" | "publish" | "pause" | "delete" | null;

function Dashboard({ gig, setGig, reload, fresh, maxPhotos }: { gig: MyGig; setGig: (g: MyGig) => void; reload: () => void; fresh: boolean; maxPhotos: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dropping, setDropping] = useState<GigPhoto | null>(null);
  const status = GIG_STATUS[gig.status];
  const removed = gig.status === "removed";
  const needsKyc = gig.missing.some((m) => /verif/i.test(m));

  const run = async (name: Busy, action: () => Promise<MyGig>) => {
    setBusy(name);
    setFailure(null);
    try {
      setGig(await action());
      return true;
    } catch (err) {
      setFailure(err instanceof ApiError || name !== "photo" ? formError(err).message : "That file is not a photo we can read.");
      reload();
      return false;
    } finally {
      setBusy(null);
    }
  };

  const dropPhoto = async () => {
    const photo = dropping;
    if (photo && (await run("photo", () => removeGigPhoto(gig.id, photo.id)))) setDropping(null);
  };

  const remove = async () => {
    setBusy("delete");
    try {
      await deleteGig(gig.id);
      router.replace("/freelance");
    } catch (err) {
      setBusy(null);
      setDeleting(false);
      setFailure(formError(err).message);
    }
  };

  return (
    <div className={vendor.page}>
      <Back href="/freelance">Freelancing</Back>

      {fresh && gig.status === "draft" && (
        <p className={vendor.note}>
          <Icon name="check" size={20} />
          <span>Saved as a draft. Add a photo, then publish it.</span>
        </p>
      )}

      <div className={vendor.head}>
        <div className={vendor.identity}>
          <h1 className={vendor.title}>{gig.title}</h1>
          <span className={vendor.muted}>{`${gig.categoryLabel}${gig.orders ? ` · ${plural(gig.orders, "order")}` : ""}`}</span>
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>

      {gig.removal && (
        <p className={vendor.note} data-tone="danger">
          <Icon name="alert" size={20} />
          <span>{`Ruxstar took this gig down: ${gig.removal.reason} Orders already placed go on.`}</span>
        </p>
      )}
      {gig.status === "paused" && (
        <p className={vendor.note}>
          <Icon name="pause" size={20} />
          <span>Paused: customers can’t see or order it. Orders already placed go on.</span>
        </p>
      )}
      {gig.missing.length > 0 && (
        <div className={vendor.note}>
          <Icon name="info" size={20} />
          <div>
            <strong>Before you can publish</strong>
            <ul className={events.qList}>
              {gig.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <h2 className={vendor.section}>{`Photos (${gig.photos.length} of ${maxPhotos})`}</h2>
      <PhotoGrid
        photos={gig.photos}
        room={removed ? null : gig.photos.length < maxPhotos}
        busy={busy === "photo"}
        cover
        onAdd={(file) => void run("photo", async () => addGigPhoto(gig.id, await shrinkPhoto(file, PHOTO_SIDE, PHOTO_ASPECT)))}
        onRemove={setDropping}
      />
      <span className={vendor.faint}>The first photo is the cover customers see in the list.</span>
      {dropping && (
        <section className={vendor.card}>
          <strong>Remove this photo?</strong>
          <span className={vendor.muted}>Customers won’t see it any more.</span>
          <div className={vendor.actions}>
            <Button variant="danger" loading={busy === "photo"} onClick={() => void dropPhoto()}>
              Remove
            </Button>
            <Button variant="ghost" disabled={busy === "photo"} onClick={() => setDropping(null)}>
              Keep it
            </Button>
          </div>
        </section>
      )}

      <h2 className={vendor.section}>Packages</h2>
      <ul className={vendor.rows}>
        {sortedPackages(gig.packages).map((p) => (
          <li key={p.tier} className={vendor.row}>
            <span className={vendor.rowText}>
              <span className={vendor.rowTitle}>{p.name}</span>
              <span className={vendor.rowLine}>{deliveryLine(p)}</span>
            </span>
            <strong>{money(p.price)}</strong>
          </li>
        ))}
      </ul>
      {gig.questions.length > 0 && <span className={vendor.muted}>{`${plural(gig.questions.length, "question")} for customers`}</span>}

      <div className={vendor.actions}>
        {!removed && (
          <Link href={`/freelance/gigs/${gig.id}/edit`} className={events.textLink}>
            Edit gig
          </Link>
        )}
        {gig.status === "live" && (
          <Link href={`/gigs/${gig.id}`} className={events.textLink}>
            See it as customers do
          </Link>
        )}
      </div>

      {failure && (
        <p className={vendor.error} role="alert">
          {failure}
        </p>
      )}

      {!removed && (
        <div className={vendor.actions}>
          {gig.status === "live" ? (
            <Button variant="secondary" size="lg" loading={busy === "pause"} onClick={() => void run("pause", () => pauseGig(gig.id))}>
              Pause this gig
            </Button>
          ) : needsKyc ? (
            <ButtonLink href="/verify" size="lg">
              Verify to publish
            </ButtonLink>
          ) : (
            <Button size="lg" loading={busy === "publish"} disabled={gig.missing.length > 0} onClick={() => void run("publish", () => publishGig(gig.id))}>
              {gig.status === "paused" ? "Publish again" : "Publish gig"}
            </Button>
          )}
        </div>
      )}

      {deleting ? (
        <section className={vendor.card}>
          <h2 className={vendor.section}>Delete this gig?</h2>
          <p className={vendor.muted}>{`${gig.title} will be deleted. This can’t be undone.`}</p>
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
        gig.orders === 0 &&
        !removed && (
          <div className={vendor.actions}>
            <button type="button" className={vendor.link} data-muted onClick={() => setDeleting(true)}>
              Delete this gig
            </button>
          </div>
        )
      )}
    </div>
  );
}

/** One of your gigs: photos, packages, publishing and pausing, editing and deleting. */
export function ManageGigScreen({ id, fresh }: { id: string; fresh: boolean }) {
  const { data, error, reload, setData } = useLoad(() => myGig(id), id);
  const rules = useLoad(loadGigsRules);

  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [reload]);

  if (data && rules.data) return <Dashboard gig={data} setGig={setData} reload={reload} fresh={fresh} maxPhotos={rules.data.limits.gigPhotos} />;
  if (error instanceof ApiError && error.status === 404) {
    return (
      <Empty title="Gig not found">
        <ButtonLink href="/freelance" variant="secondary">
          Freelancing
        </ButtonLink>
      </Empty>
    );
  }
  if (error || rules.error) return <Failed error={error ?? rules.error} onRetry={error ? reload : rules.reload} />;
  return <Loading rows={5} />;
}
