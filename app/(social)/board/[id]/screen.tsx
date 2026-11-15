"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Icon, Input, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { Board } from "@/components/turf/Board";
import { Legend } from "@/components/turf/booking";
import { deskBack, useActionKey, useDesk } from "@/components/turf/desk";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { blockSlots, groundBoard, markArrival, unblockSlots, type Board as BoardData, type BoardCourt, type BoardSlot } from "@/lib/api/turf";
import { addDays, BOOKING_STATUS, dayLong, istToday, rangeText, type TurfPermission } from "@/lib/turf";
import social from "@/components/social/social.module.css";
import order from "@/components/shop/order.module.css";
import styles from "@/components/turf/turf.module.css";

/** Customers book while you look, so the board refreshes this often while the tab is open. */
const REFRESH_MS = 60_000;
const HOUR = 3_600_000;

type Kind = "free" | "blocked" | "booking";
interface Selection {
  courtId: string;
  kind: Kind;
  startAts: string[];
}

const kindOf = (slot: BoardSlot): Kind => (slot.state === "booked" || slot.state === "held" ? "booking" : slot.state === "blocked" ? "blocked" : "free");
const slotsText = (n: number) => `${n} ${n === 1 ? "slot" : "slots"}`;

/** "7–9 pm" for back-to-back slots, else each range. */
function spanText(slots: BoardSlot[]): string {
  const sorted = [...slots].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const joined = sorted.every((s, i) => i === 0 || sorted[i - 1].endAt === s.startAt);
  return joined ? rangeText(sorted[0].start, sorted.at(-1)!.end) : sorted.map((s) => rangeText(s.start, s.end)).join(", ");
}

function Notice({ children }: { children: string }) {
  return <p className={order.faint}>{children}</p>;
}

function BlockPanel({ court, slots, can, onDone }: { court: BoardCourt; slots: BoardSlot[]; can: boolean; onDone: (message: string) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useActionKey();
  const block = async () => {
    const body = { courtId: court.id, startAts: slots.map((s) => s.startAt), ...(note.trim() ? { note: note.trim() } : {}) };
    setBusy(true);
    setFailure(null);
    try {
      const done = await blockSlots(body, key.keyFor(JSON.stringify(body)));
      key.settle();
      onDone(`Blocked ${slotsText(done.done)} on ${court.name}.`);
    } catch (err) {
      key.settle(err);
      setFailure(formError(err).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={styles.deskPanel} aria-label="Block slots">
      <h2>{`${court.name} · ${spanText(slots)}`}</h2>
      <span className={order.small}>{`${slotsText(slots.length)} free. Tap more free slots on this court to block them together.`}</span>
      {can ? (
        <>
          <Input label="Note for your team (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Like “Maintenance” or “Booked by phone”" />
          {failure && (
            <p className={order.error} role="alert">
              {failure}
            </p>
          )}
          <div className={order.actions}>
            <Button icon={<Icon name="lock" size={16} />} loading={busy} onClick={() => void block()}>
              {`Block ${slotsText(slots.length)}`}
            </Button>
          </div>
          <Notice>Players can’t book a blocked slot. Unblock it any time.</Notice>
        </>
      ) : (
        <Notice>You can’t block slots here. Ask the owner to allow it.</Notice>
      )}
    </section>
  );
}

function UnblockPanel({ court, slots, can, onDone }: { court: BoardCourt; slots: BoardSlot[]; can: boolean; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useActionKey();
  const notes = [...new Set(slots.map((s) => [s.block?.note, s.block?.by && `by ${s.block.by}`].filter(Boolean).join(", ")).filter(Boolean))];
  const unblock = async () => {
    const body = { courtId: court.id, startAts: slots.map((s) => s.startAt) };
    setBusy(true);
    setFailure(null);
    try {
      const done = await unblockSlots(body, key.keyFor(JSON.stringify(body)));
      key.settle();
      onDone(`Unblocked ${slotsText(done.done)} on ${court.name}.`);
    } catch (err) {
      key.settle(err);
      setFailure(formError(err).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={styles.deskPanel} aria-label="Blocked slots">
      <h2>{`${court.name} · ${spanText(slots)}`}</h2>
      <span className={order.small}>{`${slotsText(slots.length)} blocked${notes.length ? `: ${notes.join("; ")}` : ""}`}</span>
      {can ? (
        <>
          {failure && (
            <p className={order.error} role="alert">
              {failure}
            </p>
          )}
          <div className={order.actions}>
            <Button variant="secondary" icon={<Icon name="undo" size={16} />} loading={busy} onClick={() => void unblock()}>
              {`Unblock ${slotsText(slots.length)}`}
            </Button>
          </div>
          <Notice>Players can book them again straight away.</Notice>
        </>
      ) : (
        <Notice>You can’t unblock slots here. Ask the owner to allow it.</Notice>
      )}
    </section>
  );
}

function BookingPanel({ court, slot, can, onDone }: { court: BoardCourt; slot: BoardSlot; can: (p: TurfPermission) => boolean; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState<"arrived" | "no_show" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useActionKey();
  const b = slot.booking;
  if (!b) return null;
  const now = Date.now();
  const start = Date.parse(b.startAt);
  const until = Date.parse(b.endAt) + 24 * HOUR;
  const held = b.status === "awaiting_payment" || slot.state === "held";
  const canArrive = !held && b.arrival !== "arrived" && now >= start - HOUR / 2 && now <= until;
  const canNoShow = !held && b.arrival !== "no_show" && now >= start && now <= until;
  const status = BOOKING_STATUS[b.status];

  const mark = async (next: "arrived" | "no_show") => {
    const body = { n: b.n, status: next };
    setBusy(next);
    setFailure(null);
    try {
      await markArrival(b.id, body, key.keyFor(`${b.id}:${JSON.stringify(body)}`));
      key.settle();
      onDone(next === "arrived" ? `${b.customerName} marked as arrived.` : `${b.customerName} marked as not turned up.`);
    } catch (err) {
      key.settle(err);
      setFailure(formError(err).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={styles.deskPanel} aria-label="Booking">
      <div className={order.titleRow}>
        <h2>{held ? "Someone is paying" : b.customerName}</h2>
        <Tag tone={b.arrival === "arrived" ? "success" : b.arrival === "no_show" ? "danger" : status.tone}>
          {b.arrival === "arrived" ? "Arrived" : b.arrival === "no_show" ? "Didn’t turn up" : status.label}
        </Tag>
      </div>
      <span className={order.small}>{`${court.name} · ${rangeText(slot.start, slot.end)} · booking #${b.orderNo}${b.weeks > 1 ? ` · week ${b.n} of ${b.weeks}` : ""}`}</span>
      {held && <Notice>The slot is held while they pay, for a few minutes. It frees up if they don’t.</Notice>}
      {b.customerPhone && (
        <a className={order.small} href={`tel:${b.customerPhone}`}>
          <Icon name="phone" size={14} /> {b.customerPhone}
        </a>
      )}
      {failure && (
        <p className={order.error} role="alert">
          {failure}
        </p>
      )}
      {!held && (
        <div className={order.actions}>
          {can("turf.arrivals") && (
            <>
              <Button icon={<Icon name="check" size={16} />} loading={busy === "arrived"} disabled={!canArrive || !!busy} onClick={() => void mark("arrived")}>
                Arrived
              </Button>
              <Button variant="secondary" loading={busy === "no_show"} disabled={!canNoShow || !!busy} onClick={() => void mark("no_show")}>
                Didn’t turn up
              </Button>
            </>
          )}
          <Link className={order.small} href={`/board/bookings/${b.id}`}>
            {can("turf.cancel") ? "Open booking or cancel it" : "Open booking"}
          </Link>
        </div>
      )}
      {!held && can("turf.arrivals") && !canArrive && !canNoShow && (
        <Notice>{now < start - HOUR / 2 ? "You can mark arrival from 30 minutes before the slot." : "Arrival can be marked until a day after the slot."}</Notice>
      )}
    </section>
  );
}

function Totals({ board }: { board: BoardData }) {
  const t = board.totals;
  return (
    <div className={styles.totals} role="status">
      <Tag>{`${t.booked} booked`}</Tag>
      <Tag>{`${t.free} free`}</Tag>
      {t.blocked > 0 && <Tag>{`${t.blocked} blocked`}</Tag>}
      {t.arrived > 0 && <Tag tone="success">{`${t.arrived} arrived`}</Tag>}
      {t.noShow > 0 && <Tag tone="danger">{`${t.noShow} didn’t turn up`}</Tag>}
    </div>
  );
}

/**
 * A ground's day for its owner and ground staff: every court's slots across the day. Tap a booking to see who and mark
 * them arrived, tap free slots to block them, tap a blocked slot to free it. What each person can do comes from the
 * team permissions. Same as the app; the week view comes later, like the app's.
 */
export function BoardScreen({ id, date: initialDate }: { id: string; date?: string }) {
  const { grounds, ground, can } = useDesk(id);
  const [date, setDate] = useState(() => (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : istToday()));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const loaded = useLoad(() => groundBoard(id, date), `${id}:${date}`);
  const board = loaded.data?.date === date ? loaded.data : null;
  const { reload } = loaded;
  const back = deskBack(ground, id);
  const today = istToday();

  useEffect(() => {
    window.history.replaceState(null, "", date === today ? `/board/${id}` : `/board/${id}?date=${date}`);
  }, [id, date, today]);

  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onShow);
    const tick = setInterval(() => document.visibilityState === "visible" && reload(), REFRESH_MS);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      clearInterval(tick);
    };
  }, [reload]);

  const goTo = (next: string) => {
    setDate(next);
    setSelection(null);
    setMessage(null);
  };

  const onTap = useCallback((courtId: string, slot: BoardSlot) => {
    const kind = kindOf(slot);
    setMessage(null);
    setSelection((current) => {
      if (kind === "booking" || !current || current.courtId !== courtId || current.kind !== kind) return { courtId, kind, startAts: [slot.startAt] };
      const startAts = current.startAts.includes(slot.startAt) ? current.startAts.filter((s) => s !== slot.startAt) : [...current.startAts, slot.startAt];
      return startAts.length ? { ...current, startAts } : null;
    });
  }, []);

  const isSelected = (courtId: string, slot: BoardSlot) => selection?.courtId === courtId && selection.startAts.includes(slot.startAt);

  const court = selection && board ? board.courts.find((c) => c.id === selection.courtId) : undefined;
  const picked = court ? court.slots.filter((s) => selection!.startAts.includes(s.startAt) && kindOf(s) === selection!.kind) : [];

  const done = (text: string) => {
    setSelection(null);
    setMessage(text);
    reload();
  };

  const forbidden = loaded.error instanceof ApiError && (loaded.error.status === 403 || loaded.error.status === 404);

  return (
    <div className={styles.deskPage}>
      <Back href={back.href}>{back.label}</Back>
      <div className={order.titleRow}>
        <h1 className={order.title}>{board?.ground.name ?? ground?.name ?? "Board"}</h1>
        {ground && !ground.owner && <Tag>Ground staff</Tag>}
      </div>

      <div className={styles.dayNav}>
        <Button variant="secondary" icon={<Icon name="arrow-left" size={16} />} aria-label="Day before" onClick={() => goTo(addDays(date, -1))} />
        <input type="date" aria-label="Day" value={date} onChange={(e) => e.target.value && goTo(e.target.value)} />
        <Button variant="secondary" icon={<Icon name="arrow-right" size={16} />} aria-label="Next day" onClick={() => goTo(addDays(date, 1))} />
        {date !== today && (
          <Button variant="ghost" onClick={() => goTo(today)}>
            Today
          </Button>
        )}
        <span className={order.small} aria-live="polite">
          {date === today ? `Today, ${dayLong(date)}` : dayLong(date)}
        </span>
      </div>

      {loaded.error && !board ? (
        forbidden ? (
          <Empty title="You can’t see this board">
            <p>Only the owner and ground staff allowed to see bookings can open it.</p>
          </Empty>
        ) : (
          <div className={social.failed} role="alert">
            <p>{formError(loaded.error).message}</p>
            <Button variant="secondary" onClick={reload}>
              Try again
            </Button>
          </div>
        )
      ) : !board ? (
        <Skeleton height={240} radius={16} />
      ) : (
        <>
          <Totals board={board} />
          <Board board={board} isSelected={isSelected} onTap={onTap} />
          <Legend states={["free", "peak", "booked", "arrived", "held", "blocked"]} />
          {message && (
            <p className={order.small} role="status">
              <Icon name="check" size={14} /> {message}
            </p>
          )}
          {court && picked.length > 0 ? (
            selection!.kind === "free" ? (
              <BlockPanel key={`${court.id}:free`} court={court} slots={picked} can={can("turf.block")} onDone={done} />
            ) : selection!.kind === "blocked" ? (
              <UnblockPanel key={`${court.id}:blocked`} court={court} slots={picked} can={can("turf.block")} onDone={done} />
            ) : (
              <BookingPanel key={picked[0].startAt} court={court} slot={picked[0]} can={can} onDone={done} />
            )
          ) : (
            !message && <Notice>Tap a booking to see who it is. Tap free slots to block them, or a blocked slot to free it.</Notice>
          )}
        </>
      )}

      <ul className={order.rows}>
        <li>
          <Link href={`/board/${id}/bookings`} className={order.row}>
            <span className={order.rowIcon}>
              <Icon name="calendar" size={20} />
            </span>
            <span className={order.rowText}>
              <span className={order.rowTitle}>Bookings</span>
              <span className={order.small}>Upcoming and past, with each player’s details</span>
            </span>
            <Icon name="chevron-right" size={18} />
          </Link>
        </li>
        {can("turf.prices") && (
          <li>
            <Link href={`/board/${id}/prices`} className={order.row}>
              <span className={order.rowIcon}>
                <Icon name="wallet" size={20} />
              </span>
              <span className={order.rowText}>
                <span className={order.rowTitle}>Prices and add-ons</span>
                <span className={order.small}>Change a court’s prices, peak hours and add-ons</span>
              </span>
              <Icon name="chevron-right" size={18} />
            </Link>
          </li>
        )}
      </ul>
      {grounds.error != null && !ground && <Notice>{`Couldn’t check what you can do here: ${formError(grounds.error).message}`}</Notice>}
      {board && selection && picked.length === 0 && <Notice>That slot changed since you tapped it. Tap it again.</Notice>}
    </div>
  );
}
