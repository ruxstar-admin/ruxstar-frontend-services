"use client";

import { useState } from "react";
import { Button, ButtonLink, Icon, Input } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { PhotoGrid, ProfileFields } from "@/components/gigs/fields";
import { useFreelancing } from "@/components/gigs/use-gigs";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import {
  addPortfolioLink,
  addPortfolioPhoto,
  removePortfolioLink,
  removePortfolioPhoto,
  updateFreelancer,
  type GigPhoto,
  type GigsRules,
  type MyFreelancer,
  type PortfolioLink,
} from "@/lib/api/gigs";
import { linkErrors, profileChanges, profileDraftOf, profileErrors, type ProfileDraft } from "@/lib/gigs";
import { shrinkPhoto } from "@/lib/photo";
import vendor from "@/components/vendor/vendor.module.css";

const PHOTO_SIDE = 1440;

type Dropping = { kind: "photo"; item: GigPhoto } | { kind: "link"; item: PortfolioLink } | null;

function Portfolio({ me, setMe, max }: { me: MyFreelancer; setMe: (m: MyFreelancer) => void; max: number }) {
  const [busy, setBusy] = useState<"photo" | "link" | "drop" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [dropping, setDropping] = useState<Dropping>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [shown, setShown] = useState(false);
  const used = me.portfolio.photos.length + me.portfolio.links.length;
  const room = used < max;
  const errors = linkErrors(title, url);

  const run = async (name: "photo" | "link" | "drop", action: () => Promise<MyFreelancer>) => {
    setBusy(name);
    setFailure(null);
    try {
      setMe(await action());
      return true;
    } catch (err) {
      setFailure(err instanceof ApiError || name !== "photo" ? formError(err).message : "That file is not a photo we can read.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const addLink = async () => {
    setShown(true);
    if (Object.keys(errors).length) return;
    if (await run("link", () => addPortfolioLink({ title: title.trim(), url: url.trim() }))) {
      setAdding(false);
      setTitle("");
      setUrl("");
      setShown(false);
    }
  };

  const drop = async () => {
    const d = dropping;
    if (!d) return;
    if (await run("drop", () => (d.kind === "photo" ? removePortfolioPhoto(d.item.id) : removePortfolioLink(d.item.id)))) setDropping(null);
  };

  return (
    <>
      <h2 className={vendor.section}>{`Portfolio (${used} of ${max})`}</h2>
      <p className={vendor.muted}>Photos of your best work and links to it, like a Behance page or a website you built.</p>
      <PhotoGrid
        photos={me.portfolio.photos}
        room={room}
        busy={busy === "photo"}
        onAdd={(file) => void run("photo", async () => addPortfolioPhoto(await shrinkPhoto(file, PHOTO_SIDE)))}
        onRemove={(item) => setDropping({ kind: "photo", item })}
      />
      {me.portfolio.links.length > 0 && (
        <ul className={vendor.rows}>
          {me.portfolio.links.map((l) => (
            <li key={l.id} className={vendor.row}>
              <Icon name="at" size={20} />
              <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className={vendor.rowText}>
                <span className={vendor.rowTitle}>{l.title}</span>
                <span className={vendor.rowLine}>{l.url}</span>
              </a>
              <button type="button" className={vendor.iconButton} aria-label={`Remove ${l.title}`} onClick={() => setDropping({ kind: "link", item: l })}>
                <Icon name="close" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {dropping && (
        <section className={vendor.card}>
          <strong>{dropping.kind === "link" ? "Remove this link?" : "Remove this photo?"}</strong>
          <span className={vendor.muted}>Customers won’t see it on your page any more.</span>
          <div className={vendor.actions}>
            <Button variant="danger" loading={busy === "drop"} onClick={() => void drop()}>
              Remove
            </Button>
            <Button variant="ghost" disabled={busy === "drop"} onClick={() => setDropping(null)}>
              Keep it
            </Button>
          </div>
        </section>
      )}
      {adding ? (
        <section className={vendor.card}>
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Like “Brand work for a café”" error={shown ? errors.title : undefined} />
          <Input label="Link" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" error={shown ? errors.url : undefined} />
          <div className={vendor.actions}>
            <Button loading={busy === "link"} onClick={() => void addLink()}>
              Add link
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </section>
      ) : (
        room && (
          <div>
            <button type="button" className={vendor.link} onClick={() => setAdding(true)}>
              Add a link
            </button>
          </div>
        )
      )}
      {failure && (
        <p className={vendor.error} role="alert">
          {failure}
        </p>
      )}
    </>
  );
}

function ProfileForm({ me, setMe, rules }: { me: MyFreelancer; setMe: (m: MyFreelancer) => void; rules: GigsRules }) {
  const [draft, setDraft] = useState<ProfileDraft>(() => profileDraftOf(me));
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const errors = profileErrors(draft);
  const changes = profileChanges(draft, me);
  const changed = Object.keys(changes).length > 0;
  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const save = async () => {
    setShown(true);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setFailure(null);
    try {
      const next = await updateFreelancer(changes);
      setMe(next);
      setDraft(profileDraftOf(next));
      setSaved(true);
    } catch (err) {
      setFailure(formError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={vendor.page}>
      <Back href="/freelance">Freelancing</Back>
      <h1 className={vendor.title}>Profile and portfolio</h1>
      {!me.avatarUrl && (
        <p className={vendor.note}>
          <Icon name="info" size={20} />
          <span>Your photo comes from your Ruxstar profile. Add one there so customers see who they’re working with.</span>
        </p>
      )}
      <form
        className={vendor.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <ProfileFields draft={draft} set={set} errors={shown ? errors : {}} categories={rules.categories} />
        {failure && (
          <p className={vendor.error} role="alert">
            {failure}
          </p>
        )}
        <div className={vendor.actions}>
          <Button type="submit" loading={busy} disabled={!changed}>
            {saved && !changed ? "Saved" : "Save profile"}
          </Button>
        </div>
      </form>
      <Portfolio me={me} setMe={setMe} max={rules.limits.portfolio} />
    </div>
  );
}

/** Editing your freelancer profile, and your portfolio's photos and links. */
export function FreelanceProfileScreen() {
  const { data, error, reload, setData } = useFreelancing("profile");
  if (data?.me) return <ProfileForm me={data.me} setMe={(me) => setData((d) => (d ? { ...d, me } : d))} rules={data.rules} />;
  if (data) {
    return (
      <Empty title="You haven’t started freelancing">
        <ButtonLink href="/freelance" variant="secondary">
          Freelancing
        </ButtonLink>
      </Empty>
    );
  }
  if (error) return <Failed error={error} onRetry={reload} />;
  return <Loading rows={5} />;
}
