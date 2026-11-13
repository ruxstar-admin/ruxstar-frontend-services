"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { InviteCard } from "@/components/team/InviteCard";
import { Button, ButtonLink, Icon, Tag, type IconName } from "@/components/ui";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ACCESS, getWork, leaveTeam, type PermissionInfo, type TeamPermission, type WorkPlace } from "@/lib/api/team";
import team from "@/components/team/team.module.css";
import styles from "@/components/vendor/vendor.module.css";

const has =
  (...wanted: TeamPermission[]) =>
  (permissions: TeamPermission[]) =>
    wanted.some((p) => permissions.includes(p));

/** What someone can open at a business they work at, by what the owner allowed. */
const WORK_AREAS: { title: string; line: string; icon: IconName; allowed: (permissions: TeamPermission[]) => boolean; path: string }[] = [
  { title: "Orders", line: "New orders, ones being made, and past ones", icon: "print", allowed: has("orders.view"), path: "orders" },
  { title: "Shop", line: "Open or close it, and change what you’re allowed to", icon: "store", allowed: has("shop.open", "shop.catalog", "shop.details"), path: "shop" },
  { title: "Coupons", line: "Discounts for this shop", icon: "ticket", allowed: has("coupons.manage"), path: "coupons" },
  { title: "Post as the business", line: "It goes out under the owner’s name", icon: "edit", allowed: has("posts.create"), path: "post" },
];

function Head({ business, owner }: { business: WorkPlace["business"]; owner: string }) {
  return (
    <div className={team.inviteHead}>
      <Avatar name={business.name} url={business.photo} size={56} />
      <div className={styles.identity}>
        <h1 className={styles.name}>{business.name}</h1>
        <p className={styles.muted}>
          Owned by {owner}
          {business.city ? ` · ${business.city}` : ""}
        </p>
      </div>
    </div>
  );
}

function Allowed({ catalog, permissions }: { catalog: PermissionInfo[]; permissions: TeamPermission[] }) {
  return (
    <ul className={team.allowed}>
      {catalog
        .filter((p) => permissions.includes(p.key))
        .map((p) => (
          <li key={p.key}>
            <Icon name="check" size={18} />
            {p.label}
          </li>
        ))}
    </ul>
  );
}

function Place({ place, catalog }: { place: WorkPlace; catalog: PermissionInfo[] }) {
  const router = useRouter();
  const onSignedOut = useOnSignedOut();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const access = ACCESS[place.access];
  const areas = WORK_AREAS.filter((a) => a.allowed(place.permissions));

  const leave = async () => {
    setBusy(true);
    setError(null);
    try {
      await leaveTeam(place.id);
      router.push("/work");
    } catch (err) {
      setBusy(false);
      setConfirming(false);
      if (!onSignedOut(err)) setError(formError(err).message);
    }
  };

  return (
    <>
      <div className={styles.head}>
        <Head business={place.business} owner={place.owner.name} />
        <Tag tone={access.tone}>{access.label}</Tag>
      </div>
      {access.note && (
        <p className={styles.note} data-tone={place.access === "on_hold" ? "danger" : undefined}>
          <Icon name="info" size={20} />
          <span>{access.note}</span>
        </p>
      )}
      {place.access === "verify" && (
        <div>
          <ButtonLink href="/verify">Get verified</ButtonLink>
        </div>
      )}
      {place.access === "on" && areas.length > 0 && (
        <ul className={styles.rows}>
          {areas.map((area) => (
            <li key={area.path}>
              <Link href={`/work/${place.id}/${area.path}`} className={styles.row}>
                <Icon name={area.icon} size={20} />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{area.title}</span>
                  <span className={styles.rowLine}>{area.line}</span>
                </span>
                <Icon name="chevron-right" size={18} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <h2 className={team.section}>What you can do</h2>
      <Allowed catalog={catalog} permissions={place.permissions} />
      <p className={styles.muted}>The owner chooses these and can change them at any time.</p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {confirming ? (
        <div className={styles.note} data-tone="danger">
          <Icon name="alert" size={20} />
          <div className={styles.form}>
            <span>
              <strong>Leave {place.business.name}?</strong> Your access ends at once and the owner is told. They&apos;d need to invite you again.
            </span>
            <div className={styles.actions}>
              <Button variant="danger" loading={busy} onClick={() => void leave()}>
                Leave
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
                Stay
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <button type="button" className={styles.link} data-muted onClick={() => setConfirming(true)}>
            Leave this team
          </button>
        </div>
      )}
    </>
  );
}

/** One business you work at, or an invite to one (notifications link here with the same id). Same as the app. */
export function WorkPlaceScreen({ id }: { id: string }) {
  const router = useRouter();
  const { data, error, reload } = useLoad(() => getWork(), id);
  if (error && !data) return <Failed error={error} onRetry={reload} />;
  if (!data) return <Loading rows={2} />;
  const place = data.places.find((p) => p.id === id);
  const invite = data.invites.find((i) => i.id === id);

  return (
    <div className={styles.page}>
      <Back href="/work">Work</Back>
      {place ? (
        <Place place={place} catalog={data.permissions} />
      ) : invite ? (
        <>
          <InviteCard invite={invite} catalog={data.permissions} onAnswered={(accepted) => (accepted ? reload() : router.push("/work"))} />
          <h2 className={team.section}>What you&apos;d be able to do</h2>
          <Allowed catalog={data.permissions} permissions={invite.permissions} />
        </>
      ) : (
        <Empty title="Not open any more">
          <p>This invite ran out or was cancelled, or you&apos;re no longer on this team.</p>
          <ButtonLink href="/work" variant="secondary">
            Open Work
          </ButtonLink>
        </Empty>
      )}
    </div>
  );
}
