"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, ReasonForm, date, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { Button, ButtonLink, Card, Icon, Skeleton, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import {
  getBusiness,
  getBusinessCatalog,
  getBusinessTeam,
  holdBusiness,
  removeFromTeam,
  restoreBusiness,
  type Business,
  type BusinessCase,
  type BusinessCatalog,
} from "@/lib/api/admin";
import type { Team, TeamMember } from "@/lib/api/team";
import { MemberRow } from "@/components/team/MemberRow";
import teamStyles from "@/components/team/team.module.css";
import vendorStyles from "@/components/vendor/vendor.module.css";
import { ago } from "@/lib/time";
import { MODULE_LABEL } from "../../modules/labels";
import { BusinessTag } from "../tags";

const MISSING: Record<Business["missing"][number], string> = {
  photo: "a cover photo",
  phone: "a phone number",
  location: "the state and city",
  products: "print products",
  area: "a service area",
  pricing: "prices for every product",
};

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const placeOf = (l: NonNullable<Business["location"]>) => [l.doorNo, l.building, l.street, l.area, l.city, l.state, l.pincode].filter(Boolean).join(", ");

/** What a print business makes, where, and its starting prices. */
function PodFacts({ pod, catalog }: { pod: NonNullable<Business["pod"]>; catalog: BusinessCatalog | null }) {
  const label = (id: string) => catalog?.podProducts.find((p) => p.id === id)?.label ?? id;
  const from = (p: NonNullable<Business["pod"]>["prices"][number]) =>
    p.model === "per_page"
      ? [p.bw ? `${rupees(p.bw)}/page B&W` : null, p.color ? `${rupees(p.color)}/page colour` : null].filter(Boolean).join(", ")
      : p.basePrice
        ? `${rupees(p.basePrice)} each, from ${p.minQuantity}`
        : "No price";
  return (
    <dl className={styles.facts}>
      <Fact label="Prints" value={pod.products.length ? pod.products.map(label).join(", ") : "Nothing yet"} warn={!pod.products.length} />
      <Fact label="Serves" value={pod.serveAll ? "Every city" : pod.cities.length ? pod.cities.join(", ") : "No area yet"} warn={!pod.serveAll && !pod.cities.length} />
      <Fact label="Turnaround" value={`${pod.turnaroundDays} ${pod.turnaroundDays === 1 ? "day" : "days"}`} />
      <Fact label="Minimum order" value={pod.minOrder ? rupees(pod.minOrder) : "None"} />
      {pod.notes && <Fact label="Notes" value={pod.notes} />}
      {pod.prices.map((p) => (
        <Fact key={p.product} label={label(p.product)} value={from(p)} />
      ))}
      {pod.unpriced.length > 0 && <Fact label="Without a price" value={pod.unpriced.map(label).join(", ")} warn />}
    </dl>
  );
}

function Actions({ c, onChanged }: { c: BusinessCase; onChanged: (next: BusinessCase, message: string) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("businesses.manage");
  const [holding, setHolding] = useState(false);
  const [busy, setBusy] = useState<"hold" | "restore" | null>(null);
  const keys = useRef({ hold: crypto.randomUUID(), restore: crypto.randomUUID() });
  if (!canManage) return null;

  async function run(kind: "hold" | "restore", reason = "") {
    setBusy(kind);
    try {
      const k = keys.current[kind];
      const next = kind === "hold" ? await holdBusiness(c.business.id, reason, k) : await restoreBusiness(c.business.id, k);
      keys.current[kind] = crypto.randomUUID();
      setHolding(false);
      onChanged(next, kind === "hold" ? "Business put on hold. The vendor has been told why." : "Hold lifted. The vendor has been told.");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(null);
    }
  }

  if (holding) {
    return (
      <ReasonForm
        prompt="Why is this business going on hold? Customers stop seeing it and the vendor can't change it. They will see this reason."
        placeholder="For example: the photos show another shop. Upload your own."
        confirm="Put on hold"
        busy={busy === "hold"}
        onCancel={() => setHolding(false)}
        onSubmit={(reason) => run("hold", reason)}
      />
    );
  }

  return (
    <div className={styles.actions}>
      {c.business.suspension ? (
        <Button onClick={() => run("restore")} loading={busy === "restore"} disabled={!!busy}>
          Lift the hold
        </Button>
      ) : (
        <Button variant="danger" onClick={() => setHolding(true)} disabled={!!busy}>
          Put on hold
        </Button>
      )}
    </div>
  );
}

/** The people the vendor has on the business's team. Anyone can be removed with a reason both they and the vendor see. Same as the app. */
function BusinessTeam({ businessId }: { businessId: string }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("businesses.manage");
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());

  useEffect(() => {
    let live = true;
    getBusinessTeam(businessId).then(
      (next) => live && setTeam(next),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [businessId, attempt, onSignedOut]);

  async function remove(reason: string) {
    if (!removing) return;
    setBusy(true);
    try {
      await removeFromTeam(businessId, removing.id, reason, key.current);
      key.current = crypto.randomUUID();
      toast(`${removing.person.name} was removed. They and the vendor have been told why.`, "success");
      setRemoving(null);
      setAttempt((n) => n + 1);
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.page}>
      <h2 className={teamStyles.section}>Team</h2>
      {error ? (
        <Failed
          error={error}
          onRetry={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        />
      ) : !team ? (
        <Skeleton height={64} radius={12} />
      ) : removing ? (
        <ReasonForm
          prompt={`Why is ${removing.person.name} being removed? Their access ends at once. They and the vendor will see this reason.`}
          placeholder="For example: reported for taking orders outside Ruxstar."
          confirm="Remove"
          busy={busy}
          onCancel={() => setRemoving(null)}
          onSubmit={(reason) => void remove(reason)}
        />
      ) : team.members.length ? (
        <ul className={vendorStyles.rows}>
          {team.members.map((m) => (
            <li key={m.id}>
              <MemberRow member={m} catalog={team.permissions} onClick={canManage ? () => setRemoving(m) : undefined} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>No one on the team.</p>
      )}
    </section>
  );
}

export function BusinessScreen({ id }: { id: string }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canAudit = useCan("audit.view");
  const canSeePeople = useCan("users.view");
  const [c, setCase] = useState<BusinessCase | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [catalog, setCatalog] = useState<BusinessCatalog | null>(null);

  useEffect(() => {
    getBusinessCatalog().then(setCatalog, () => undefined);
  }, []);

  useEffect(() => {
    let live = true;
    getBusiness(id).then(
      (next) => live && setCase(next),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [id, attempt, onSignedOut]);

  const b = c?.business;

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <div>
          <ButtonLink href="/admin/businesses" variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
            Businesses
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
        ) : !c || !b ? (
          <Skeleton height={420} radius={16} />
        ) : (
          <Card as="section" padding="lg" className={styles.page}>
            <div className={styles.head}>
              <div>
                <h1 className={styles.title}>{b.name}</h1>
                <p className={styles.muted}>
                  {MODULE_LABEL[b.module]}
                  {catalog ? ` · ${catalog.categories.flatMap((cat) => cat.types).find((t) => t.id === b.type)?.label ?? b.type}` : ""}
                </p>
              </div>
              <div className={styles.tags}>
                <BusinessTag business={b} />
              </div>
            </div>

            {b.suspension && (
              <p className={styles.note} data-tone="danger">
                On hold {ago(b.suspension.at)}
                {c.suspendedBy ? ` by ${c.suspendedBy.name}` : ""}: {b.suspension.reason}
              </p>
            )}

            {b.photos.length > 0 && (
              <div className={styles.thumbs}>
                {b.photos.map((p) => (
                  <img key={p.id} src={p.url} alt="" loading="lazy" width={96} height={96} />
                ))}
              </div>
            )}

            {b.description && <p className={styles.text}>{b.description}</p>}

            <dl className={styles.facts}>
              <Fact label="Phone" value={b.phone ?? "—"} />
              <Fact label="Location" value={b.location ? placeOf(b.location) : "—"} />
              <Fact label="GSTIN" value={b.gstin ? `${b.gstin.number}${b.gstin.status ? ` (${b.gstin.status})` : ""}` : "Not given"} />
              {b.gstin?.legalName && <Fact label="GST legal name" value={b.gstin.legalName} />}
              {b.status === "draft" && b.missing.length > 0 && <Fact label="Missing to publish" value={b.missing.map((m) => MISSING[m] ?? m).join(", ")} warn />}
              <Fact label="Published" value={b.publishedAt ? date(b.publishedAt) : "Not yet"} />
              <Fact label="Created" value={date(b.createdAt)} />
              <Fact label="Business id" value={b.id} />
            </dl>

            {b.pod && <PodFacts pod={b.pod} catalog={catalog} />}

            <dl className={styles.facts}>
              <Fact
                label="Vendor"
                value={
                  c.owner ? (
                    canSeePeople ? (
                      <Link href={`/admin/users/${c.owner.id}`}>
                        {c.owner.name || "No name"} (@{c.owner.username})
                      </Link>
                    ) : (
                      `${c.owner.name || "No name"} (@${c.owner.username})`
                    )
                  ) : (
                    "Account gone"
                  )
                }
                warn={!c.owner || c.owner.status !== "active"}
              />
              {c.owner && <Fact label="Vendor phone" value={c.owner.phone} />}
              <Fact
                label="Paid to"
                value={c.payoutMethod ? `${c.payoutMethod.label}${c.payoutMethod.holderName ? ` · ${c.payoutMethod.holderName}` : ""}` : "Not set up"}
                warn={!c.payoutMethod}
              />
            </dl>

            {b.module === "pod" && <BusinessTeam businessId={b.id} />}

            <Actions
              c={c}
              onChanged={(next, message) => {
                setCase(next);
                toast(message, "success");
              }}
            />

            {canAudit && (
              <div>
                <ButtonLink href={`/admin/audit?target=${b.id}`} variant="ghost" icon={<Icon name="clock" size={18} />}>
                  History for this business
                </ButtonLink>
              </div>
            )}
          </Card>
        )}
      </div>
    </Needs>
  );
}
