"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, ReasonForm, date, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { Button, ButtonLink, Card, Icon, Skeleton, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { getBusiness, holdBusiness, restoreBusiness, type BusinessCase } from "@/lib/api/admin";
import { ago } from "@/lib/time";
import { MODULE_LABEL } from "../../modules/labels";
import { BusinessTag } from "../tags";

const MISSING: Record<string, string> = {
  description: "a description",
  phone: "a phone number",
  address: "an address",
  photo: "a photo",
};

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

export function BusinessScreen({ id }: { id: string }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canAudit = useCan("audit.view");
  const canSeePeople = useCan("users.view");
  const [c, setCase] = useState<BusinessCase | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

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
                <p className={styles.muted}>{MODULE_LABEL[b.module]}</p>
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
              <Fact label="Email" value={b.email ?? "—"} />
              <Fact
                label="Address"
                value={b.address ? [b.address.line1, b.address.line2, b.address.city, b.address.state, b.address.pincode].filter(Boolean).join(", ") : "—"}
              />
              <Fact label="GSTIN" value={b.gstin ? `${b.gstin.number}${b.gstin.status ? ` (${b.gstin.status})` : ""}` : "Not given"} />
              {b.gstin?.legalName && <Fact label="GST legal name" value={b.gstin.legalName} />}
              {b.status === "draft" && b.missing.length > 0 && <Fact label="Missing to publish" value={b.missing.map((m) => MISSING[m] ?? m).join(", ")} warn />}
              <Fact label="Published" value={b.publishedAt ? date(b.publishedAt) : "Not yet"} />
              <Fact label="Created" value={date(b.createdAt)} />
              <Fact label="Business id" value={b.id} />
            </dl>

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
