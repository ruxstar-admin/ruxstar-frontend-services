import { Fragment, memo } from "react";
import { Tag } from "@/components/ui";
import type { Board, BoardBed, BoardBedState } from "@/lib/api/stays";
import { BED_STATE, dayShort } from "@/lib/stays";
import styles from "./stays.module.css";

export interface BedCell {
  roomId: string;
  bedId: string;
  day: string;
}

const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

function cellText(bed: BoardBed | undefined): string {
  if (!bed) return "–";
  if (bed.reservation && (bed.state === "reserved" || bed.state === "occupied")) return firstName(bed.reservation.tenantName);
  return bed.state === "held" ? "Paying" : bed.state === "closed" ? "Full" : "Free";
}

/** A bed on one day, from that day's board. */
export const bedOn = (board: Board | undefined, roomId: string, bedId: string) => board?.rooms.find((r) => r.id === roomId)?.beds.find((b) => b.id === bedId);

const LEGEND: BoardBedState[] = ["free", "reserved", "occupied", "held", "closed"];

export function BedLegend() {
  return (
    <ul className={styles.legend} aria-label="What the colours mean">
      {LEGEND.map((s) => (
        <li key={s}>
          <span className={styles.swatch} data-state={s} aria-hidden />
          {BED_STATE[s]}
        </li>
      ))}
    </ul>
  );
}

/**
 * The bed map: every bed down the side, grouped by room, and each day across, from one board per day. Each cell says who
 * has the bed that day or whether it's free; tap one for the bed, its tenant and marking it full.
 */
export const BedMap = memo(function BedMap({
  boards,
  days,
  today,
  selected,
  onTap,
}: {
  boards: Board[];
  days: string[];
  today: string;
  selected: BedCell | null;
  onTap: (cell: BedCell) => void;
}) {
  const rooms = boards[0]?.rooms ?? [];
  return (
    <div className={styles.boardWrap}>
      <div className={styles.board} style={{ gridTemplateColumns: `120px repeat(${days.length}, minmax(88px, 1fr))` }}>
        <span className={styles.corner}>Bed</span>
        {days.map((d) => (
          <span key={d} className={styles.colHead} data-today={d === today || undefined}>
            {d === today ? "Today" : dayShort(d)}
          </span>
        ))}
        {rooms.map((room) => (
          <Fragment key={room.id}>
            <div className={styles.roomRow}>
              {room.name}
              {room.status === "paused" && <Tag>Marked full</Tag>}
            </div>
            {room.beds.map((bed) => (
              <Fragment key={bed.id}>
                <span className={styles.rowHead}>
                  <span className={styles.dot} data-small data-state={bed.status === "closed" ? "closed" : "free"} aria-hidden>
                    {bed.label}
                  </span>
                  {room.kind === "private" && room.beds.length === 1 ? "Room" : `Bed ${bed.label}`}
                </span>
                {days.map((d, i) => {
                  const that = bedOn(boards[i], room.id, bed.id);
                  const text = cellText(that);
                  const pressed = selected?.bedId === bed.id && selected.day === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      className={styles.cell}
                      data-state={that?.state}
                      data-past={d < today || undefined}
                      aria-pressed={pressed}
                      aria-label={`${room.name}, bed ${bed.label}, ${dayShort(d)}: ${that ? BED_STATE[that.state] : "not known"}${that?.reservation ? `, ${that.reservation.tenantName}` : ""}`}
                      onClick={() => onTap({ roomId: room.id, bedId: bed.id, day: d })}
                    >
                      <span>{text}</span>
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
});
