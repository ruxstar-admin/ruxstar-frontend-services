import { Icon, type IconName } from "@/components/ui";
import { money } from "@/lib/api/shops";
import type { BedState } from "@/lib/api/stays";
import type { StepState, TimelineStep } from "@/lib/stays";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "./stays.module.css";

export function Fact({ icon, title, detail }: { icon: IconName; title: string; detail?: string | null }) {
  return (
    <div className={events.factRow}>
      <Icon name={icon} size={18} />
      <span className={events.factText}>
        <strong>{title}</strong>
        {detail && <span className={order.small}>{detail}</span>}
      </span>
    </div>
  );
}

const BED_WORD: Record<BedState, string> = { free: "free", taken: "taken", closed: "full" };

/**
 * A room's beds as dots: free, taken or full, each with its own look besides colour. With `onPick`, free beds are buttons
 * and the picked one is pressed; `state` undefined means not known yet.
 */
export function BedDots({
  beds,
  picked,
  onPick,
  room,
}: {
  beds: { id: string; label: string; state?: BedState }[];
  picked?: string | null;
  onPick?: (bedId: string) => void;
  room: string;
}) {
  return (
    <ul className={styles.dots} aria-label={`Beds in ${room}`}>
      {beds.map((b) => {
        const word = b.state ? BED_WORD[b.state] : "checking";
        return (
          <li key={b.id}>
            {onPick ? (
              <button
                type="button"
                className={styles.dot}
                data-state={b.state ?? "unknown"}
                aria-pressed={picked === b.id}
                aria-label={`Bed ${b.label}, ${word}`}
                disabled={b.state !== "free"}
                onClick={() => onPick(b.id)}
              >
                {b.label}
              </button>
            ) : (
              <span className={styles.dot} data-state={b.state ?? "unknown"} role="img" aria-label={`Bed ${b.label}, ${word}`}>
                {b.label}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function DotLegend({ picking }: { picking?: boolean }) {
  const items: { state: string; label: string }[] = [
    { state: "free", label: "Free" },
    { state: "taken", label: "Taken" },
    { state: "closed", label: "Full" },
    ...(picking ? [{ state: "picked", label: "Yours" }] : []),
  ];
  return (
    <ul className={styles.legend} aria-label="What the dots mean">
      {items.map((i) => (
        <li key={i.state}>
          <span className={styles.dot} data-small data-state={i.state} aria-pressed={i.state === "picked" ? true : undefined} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export function PriceLine({ label, amount, strong, minus }: { label: string; amount: number; strong?: boolean; minus?: boolean }) {
  return (
    <div className={strong ? `${order.priceRow} ${order.total}` : order.priceRow}>
      <dt>{label}</dt>
      <dd>{`${minus ? "− " : ""}${money(amount)}`}</dd>
    </div>
  );
}

/** A − count + control, for months and nights. */
export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <span className={styles.stepper} role="group" aria-label={label}>
      <button type="button" className={styles.step} disabled={value <= min} aria-label={`Fewer ${label}`} onClick={() => onChange(value - 1)}>
        <Icon name="minus" size={16} />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" className={styles.step} disabled={value >= max} aria-label={`More ${label}`} onClick={() => onChange(value + 1)}>
        <Icon name="plus" size={16} />
      </button>
    </span>
  );
}

const STEP_ICON: Record<StepState, IconName | null> = { done: "check", now: "clock", todo: null, problem: "alert" };
const STEP_WORD: Record<StepState, string> = { done: "Done", now: "Now", todo: "Next", problem: "Needs attention" };

/** Where a reservation is: reserved, moved in, the window to raise a problem, then done. */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className={styles.timeline}>
      {steps.map((s) => {
        const icon = STEP_ICON[s.state];
        return (
          <li key={s.key ?? s.title} data-state={s.state} aria-current={s.state === "now" ? "step" : undefined}>
            <span className={styles.mark} aria-hidden>
              {icon && <Icon name={icon} size={14} />}
            </span>
            <span className={styles.stepText}>
              <strong>
                <span className="sr-only">{`${STEP_WORD[s.state]}: `}</span>
                {s.title}
              </strong>
              {s.detail && <span className={order.small}>{s.detail}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
