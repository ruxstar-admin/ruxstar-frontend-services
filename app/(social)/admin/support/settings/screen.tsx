"use client";

import { useEffect, useRef, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, date, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { Button, ButtonLink, Card, Icon, Input, Skeleton, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { newIdempotencyKey } from "@/lib/api/client";
import { getSupportSettings, saveSupportSettings, type SlaHours, type SupportPriority, type SupportSettings } from "@/lib/api/support";
import { PRIORITY } from "@/lib/support";

const MAX_HOURS = 336;
const ORDER: SupportPriority[] = ["urgent", "high", "normal", "low"];

type Draft = Record<SupportPriority, string>;
const draftOf = (hours: SlaHours): Draft => ({ urgent: String(hours.urgent), high: String(hours.high), normal: String(hours.normal), low: String(hours.low) });
const valid = (value: string) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= MAX_HOURS;

function Form({ settings, onSaved }: { settings: SupportSettings; onSaved: (next: SupportSettings) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("support.manage");
  const [draft, setDraft] = useState<Draft>(() => draftOf(settings.hours));
  const [saving, setSaving] = useState(false);
  const key = useRef(newIdempotencyKey());

  const allValid = ORDER.every((p) => valid(draft[p]));
  const changed = ORDER.some((p) => draft[p] !== String(settings.hours[p]));

  const save = async () => {
    setSaving(true);
    try {
      const hours = Object.fromEntries(ORDER.map((p) => [p, Number(draft[p])])) as SlaHours;
      const next = await saveSupportSettings(hours, key.current);
      key.current = newIdempotencyKey();
      setDraft(draftOf(next.hours));
      onSaved(next);
      toast("Saved.", "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card as="section" padding="lg" className={styles.page}>
      <p className={styles.muted}>
        How long Ruxstar has to answer a ticket waiting on us, by its priority. A ticket past it shows as overdue. New times apply to the next reply each
        ticket waits for.
      </p>
      <div className={styles.facts}>
        {ORDER.map((p) => (
          <Input
            key={p}
            label={`${PRIORITY[p].label}, in hours`}
            inputMode="numeric"
            value={draft[p]}
            onChange={(e) => setDraft((d) => ({ ...d, [p]: e.target.value.replace(/[^0-9]/g, "") }))}
            maxLength={3}
            disabled={!canManage || saving}
            error={valid(draft[p]) ? undefined : `1 to ${MAX_HOURS} hours.`}
          />
        ))}
      </div>
      <div className={styles.actions}>
        {settings.updatedAt && <span className={styles.muted}>{`Last changed ${date(settings.updatedAt)}`}</span>}
        {canManage ? (
          <Button loading={saving} disabled={!allValid || !changed} onClick={() => void save()}>
            Save
          </Button>
        ) : (
          <span className={styles.muted}>Changing these is not part of your access.</span>
        )}
      </div>
    </Card>
  );
}

/** Reply-by times for help tickets, by priority. Defaults: urgent 2 hours, high 8, normal 24, low 72. Same as the app. */
export function SupportSettingsScreen() {
  const onSignedOut = useOnSignedOut();
  const [settings, setSettings] = useState<SupportSettings | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    getSupportSettings().then(
      (next) => live && setSettings(next),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [attempt, onSignedOut]);

  return (
    <Needs need="support.view">
      <div className={styles.page}>
        <div>
          <ButtonLink href="/admin/support" variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
            Help tickets
          </ButtonLink>
        </div>
        <h1 className={styles.title}>Reply-by times</h1>
        {error ? (
          <Failed
            error={error}
            onRetry={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          />
        ) : !settings ? (
          <Skeleton height={320} radius={16} />
        ) : (
          <Form settings={settings} onSaved={setSettings} />
        )}
      </div>
    </Needs>
  );
}
