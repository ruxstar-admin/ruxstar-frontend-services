"use client";

import { useState } from "react";
import { useOnSignedOut } from "@/components/social/session";
import { Button, Icon, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import type { CouponPatch, ManagedCoupon } from "@/lib/api/admin";
import { money } from "@/lib/api/shops";
import { dayText, draftErrors, draftOf, patchOf, perCustomerLine, shopsChanged, STATE, todayKey, usesLine } from "@/lib/coupons";
import { CouponFields } from "./CouponFields";
import styles from "./coupons.module.css";

interface CouponCardProps {
  coupon: ManagedCoupon;
  /** Change its dates, limits and (for vendors) shops. */
  canEdit: boolean;
  /** Switch it off or on. */
  canSwitch: boolean;
  /** The vendor's print shops, when they choose where it works. */
  shops?: { id: string; name: string }[];
  /** The Ruxstar team sees whose coupon it is. */
  forTeam?: boolean;
  save: (patch: CouponPatch & { businessIds?: string[] }) => Promise<ManagedCoupon>;
  onSaved: (after: ManagedCoupon) => void;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** One coupon: its code and state, everything about it when opened, and changing it. Same as the app. */
export function CouponCard({ coupon: c, canEdit, canSwitch, shops, forTeam, save, onSaved }: CouponCardProps) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => draftOf(c));
  const [busy, setBusy] = useState<"save" | "switch" | null>(null);
  const state = STATE[c.state];
  const errors = draftErrors(draft, { creating: false, needsShops: !!shops, today: todayKey() });
  const patch = { ...patchOf(draft, c), ...(shops && shopsChanged(draft, c) ? { businessIds: draft.businessIds } : {}) };
  const changed = Object.keys(patch).length > 0;
  /** The team only switches a vendor's coupon back on if the team switched it off; a vendor can't undo the team. */
  const switchable = canSwitch && (forTeam ? c.fundedBy === "ruxstar" || c.active || c.stoppedByRuxstar : !c.stoppedByRuxstar);

  async function run(kind: "save" | "switch", body: CouponPatch & { businessIds?: string[] }) {
    setBusy(kind);
    try {
      const after = await save(body);
      setEditing(false);
      setDraft(draftOf(after));
      onSaved(after);
      toast(kind === "save" ? "Saved." : after.active ? `${after.code} is on.` : `${after.code} is off.`, "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className={styles.card} data-open={open || undefined}>
      <button type="button" className={styles.head} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={styles.headText}>
          <span className={styles.code}>{c.code}</span>
          <span className={styles.line}>{`${c.label} · ${usesLine(c)}${forTeam && c.vendor ? ` · ${c.vendor.name}` : ""}`}</span>
        </span>
        <Tag tone={state.tone}>{state.label}</Tag>
        <Icon name="chevron-down" size={20} className={styles.chevron} />
      </button>

      {open && (
        <div className={styles.body}>
          {editing ? (
            <CouponFields draft={draft} onChange={setDraft} errors={errors} creating={false} canMoveStart={c.state === "scheduled"} shops={shops} />
          ) : (
            <dl className={styles.facts}>
              {forTeam && c.vendor && <Fact label="Vendor" value={c.vendor.name} />}
              <Fact label="Works at" value={c.businesses.length ? c.businesses.map((b) => b.name).join(", ") : "Every print shop"} />
              <Fact label="Smallest order" value={c.minOrder ? money(c.minOrder) : "None"} />
              <Fact label="Starts" value={c.startsAt ? dayText(c.startsAt) : "When made"} />
              <Fact label="Ends" value={c.endsAt ? dayText(c.endsAt) : "No end date"} />
              <Fact label="Total uses" value={c.limit !== null ? `${c.used} of ${c.limit}` : `${c.used}, no limit`} />
              <Fact label="Per customer" value={perCustomerLine(c)} />
              <Fact label="First order only" value={c.firstOrderOnly ? "Yes" : "No"} />
              <Fact label="At checkout" value={c.listed ? "Shown" : "Code only"} />
              <Fact label="Paid by" value={c.fundedBy === "ruxstar" ? "Ruxstar" : "The vendor"} />
            </dl>
          )}
          {c.stoppedByRuxstar && (
            <p className={styles.note}>
              {forTeam ? "Ruxstar switched this off. The vendor can't switch it back on." : "Ruxstar switched this coupon off. Contact Ruxstar support to use it again."}
            </p>
          )}
          {editing ? (
            <div className={styles.actions}>
              <Button loading={busy === "save"} disabled={!changed || Object.keys(errors).length > 0 || busy !== null} onClick={() => void run("save", patch)}>
                Save changes
              </Button>
              <Button
                variant="ghost"
                disabled={busy !== null}
                onClick={() => {
                  setEditing(false);
                  setDraft(draftOf(c));
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            (canEdit || switchable) && (
              <div className={styles.actions}>
                {canEdit && (
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => {
                      setDraft(draftOf(c));
                      setEditing(true);
                    }}
                  >
                    Change
                  </Button>
                )}
                {switchable && (
                  <Button variant="secondary" loading={busy === "switch"} disabled={busy !== null} onClick={() => void run("switch", { active: !c.active })}>
                    {c.active ? "Switch off" : "Switch on"}
                  </Button>
                )}
              </div>
            )
          )}
        </div>
      )}
    </li>
  );
}
