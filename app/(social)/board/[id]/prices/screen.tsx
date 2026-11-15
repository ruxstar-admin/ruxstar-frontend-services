"use client";

import { useState } from "react";
import { Button, Icon } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { useDesk } from "@/components/turf/desk";
import { PricesFields, pricesDraftOf, pricesErrors, pricesOf } from "@/components/turf/PricesFields";
import { formError } from "@/lib/api/account";
import { getGround, setCourtPrices, turfRules, type CourtView, type TurfRulesView } from "@/lib/api/turf";
import vendor from "@/components/vendor/vendor.module.css";

function CourtPrices({ court, rules, onSaved }: { court: CourtView; rules: TurfRulesView; onSaved: (courts: CourtView[]) => void }) {
  const [draft, setDraft] = useState(() => pricesDraftOf(court));
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const errors = pricesErrors(draft, rules);

  const save = async () => {
    setShown(true);
    setSaved(false);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setFailure(null);
    try {
      const next = await setCourtPrices(court.id, pricesOf(draft));
      onSaved(next.courtList);
      setSaved(true);
    } catch (err) {
      setFailure(formError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className={vendor.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <PricesFields
        draft={draft}
        onChange={(next) => {
          setDraft(next);
          setSaved(false);
        }}
        errors={shown ? errors : {}}
        rules={rules}
        hours={court.hours}
        slotMinutes={court.slotMinutes}
      />
      {failure && (
        <p className={vendor.error} role="alert">
          {failure}
        </p>
      )}
      {saved && (
        <p className={vendor.note} role="status">
          <Icon name="check" size={20} />
          <span>Saved. New bookings pay these prices; ones already made keep theirs.</span>
        </p>
      )}
      <div className={vendor.actions}>
        <Button type="submit" size="lg" loading={busy}>
          Save prices
        </Button>
      </div>
    </form>
  );
}

/** For the owner and staff allowed to change prices: one court at a time, its base, weekend and peak prices and add-ons. */
export function DeskPricesScreen({ id }: { id: string }) {
  const { ground: desk, can } = useDesk(id);
  const rules = useLoad(() => turfRules(), "turf");
  const ground = useLoad(() => getGround(id), id);
  const [courtId, setCourtId] = useState<string | null>(null);
  const courts = ground.data?.courtList ?? [];
  const court = courts.find((c) => c.id === courtId) ?? courts[0];
  const failed = rules.error ?? ground.error;

  if (failed && !(rules.data && ground.data))
    return (
      <Failed
        error={failed}
        onRetry={() => {
          rules.reload();
          ground.reload();
        }}
      />
    );
  if (!rules.data || !ground.data) return <Loading rows={4} />;

  return (
    <div className={vendor.page}>
      <Back href={`/board/${id}`}>Board</Back>
      <h1 className={vendor.title}>Prices and add-ons</h1>
      {desk && !can("turf.prices") ? (
        <Empty title="You can’t change prices here">
          <p>Ask the owner to allow it in the team settings.</p>
        </Empty>
      ) : !court ? (
        <Empty title="No courts yet">
          <p>The owner adds courts from the ground’s setup.</p>
        </Empty>
      ) : (
        <>
          {courts.length > 1 && (
            <div className={vendor.chips} role="radiogroup" aria-label="Court">
              {courts.map((c) => (
                <button key={c.id} type="button" role="radio" className={vendor.chip} aria-checked={c.id === court.id} aria-pressed={c.id === court.id} onClick={() => setCourtId(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <CourtPrices
            key={court.id}
            court={court}
            rules={rules.data}
            onSaved={(next) => ground.setData((g) => (g ? { ...g, courtList: next } : g))}
          />
        </>
      )}
    </div>
  );
}
