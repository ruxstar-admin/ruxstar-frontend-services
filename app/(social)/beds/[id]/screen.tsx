"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Icon, Skeleton, Tag, type IconName } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { BedLegend, BedMap, bedOn, type BedCell } from "@/components/stays/BedMap";
import { deskBack, useActionKey, useStaysDesk } from "@/components/stays/desk";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { bedBoard, setBedStatus, setRoomStatus, type Board, type BoardReservation, type BoardRoom } from "@/lib/api/stays";
import { addDays, BED_STATE, dayLong, dayShort, istToday, STAY_STATUS, type StaysPermission } from "@/lib/stays";
import social from "@/components/social/social.module.css";
import order from "@/components/shop/order.module.css";
import styles from "@/components/stays/stays.module.css";

/** Tenants reserve while you look, so the map refreshes this often while the tab is open. */
const REFRESH_MS = 60_000;
const WEEK = 7;

function Notice({ children }: { children: string }) {
  return <p className={order.faint}>{children}</p>;
}

function Stay({ title, r, open }: { title: string; r: BoardReservation; open: boolean }) {
  const status = STAY_STATUS[r.status];
  const until = r.until ? ` – ${dayShort(r.until.slice(0, 10))}` : ", no end date yet";
  return (
    <div className={order.panel}>
      <div className={order.titleRow}>
        <span className={order.small}>{title}</span>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>
      <strong>{r.status === "awaiting_payment" ? "Someone is paying" : r.tenantName}</strong>
      <span className={order.small}>{`From ${dayShort(r.moveIn)}${until} · #${r.orderNo}`}</span>
      {open && r.status !== "awaiting_payment" && (
        <Link className={order.small} href={`/beds/reservations/${r.id}`}>
          Open reservation
        </Link>
      )}
    </div>
  );
}

function BedPanel({
  board,
  room,
  cell,
  can,
  onDone,
}: {
  board: Board;
  room: BoardRoom;
  cell: BedCell;
  can: (p: StaysPermission) => boolean;
  onDone: (message: string) => void;
}) {
  const [busy, setBusy] = useState<"bed" | "room" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useActionKey();
  const bed = bedOn(board, room.id, cell.bedId);
  if (!bed) return null;
  const closed = bed.status === "closed";
  const paused = room.status === "paused";

  const markBed = async () => {
    const next = closed ? "open" : "closed";
    setBusy("bed");
    setFailure(null);
    try {
      await setBedStatus(bed.id, next, key.keyFor(`bed:${bed.id}:${next}`));
      key.settle();
      onDone(next === "closed" ? `Bed ${bed.label} in ${room.name} is marked full.` : `Bed ${bed.label} in ${room.name} is free to reserve again.`);
    } catch (err) {
      key.settle(err);
      setFailure(formError(err).message);
    } finally {
      setBusy(null);
    }
  };
  const markRoom = async () => {
    const next = paused ? "live" : "paused";
    setBusy("room");
    setFailure(null);
    try {
      await setRoomStatus(room.id, next, key.keyFor(`room:${room.id}:${next}`));
      key.settle();
      onDone(next === "paused" ? `${room.name} is marked full.` : `${room.name} is taking reservations again.`);
    } catch (err) {
      key.settle(err);
      setFailure(formError(err).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={styles.deskPanel} aria-label="Bed">
      <div className={order.titleRow}>
        <h2>{`${room.name} · bed ${bed.label}`}</h2>
        <Tag tone={bed.state === "free" ? "success" : bed.state === "closed" ? "neutral" : bed.state === "held" ? "warning" : "neutral"}>{BED_STATE[bed.state]}</Tag>
      </div>
      <span className={order.small}>{dayLong(cell.day)}</span>
      {bed.reservation && <Stay title="That day" r={bed.reservation} open={can("stays.reservations")} />}
      {bed.next && <Stay title="Next" r={bed.next} open={can("stays.reservations")} />}
      {!bed.reservation && !bed.next && bed.state === "free" && <Notice>No reservations from this day on.</Notice>}
      {failure && (
        <p className={order.error} role="alert">
          {failure}
        </p>
      )}
      {can("stays.beds") ? (
        <>
          <div className={order.actions}>
            <Button variant={closed ? "primary" : "secondary"} icon={<Icon name={closed ? "undo" : "lock"} size={16} />} loading={busy === "bed"} disabled={!!busy} onClick={() => void markBed()}>
              {closed ? "Mark bed free" : "Mark bed full"}
            </Button>
            <Button variant="ghost" loading={busy === "room"} disabled={!!busy} onClick={() => void markRoom()}>
              {paused ? "Open the room again" : "Mark whole room full"}
            </Button>
          </div>
          <Notice>Tenants can’t reserve a bed or room marked full, from today on. Reservations already made stay as they are.</Notice>
        </>
      ) : (
        <Notice>You can’t mark beds full here. Ask the owner to allow it.</Notice>
      )}
    </section>
  );
}

function Totals({ board }: { board: Board }) {
  const t = board.totals;
  return (
    <div className={styles.totals} role="status">
      <Tag tone="success">{`${t.free} free`}</Tag>
      <Tag>{`${t.reserved} reserved`}</Tag>
      <Tag>{`${t.occupied} moved in`}</Tag>
      {t.held > 0 && <Tag tone="warning">{`${t.held} paying now`}</Tag>}
      {t.closed > 0 && <Tag>{`${t.closed} marked full`}</Tag>}
    </div>
  );
}

function DeskLink({ href, icon, title, line }: { href: string; icon: IconName; title: string; line: string }) {
  return (
    <li>
      <Link href={href} className={order.row}>
        <span className={order.rowIcon}>
          <Icon name={icon} size={20} />
        </span>
        <span className={order.rowText}>
          <span className={order.rowTitle}>{title}</span>
          <span className={order.small}>{line}</span>
        </span>
        <Icon name="chevron-right" size={18} />
      </Link>
    </li>
  );
}

/**
 * A property's beds for a week, for its owner and wardens: who has each bed each day, who's paying right now and which
 * beds are marked full. Tap a cell for the bed, its tenant, the next one in, and marking it full or free.
 */
export function BedMapScreen({ id, from: initialFrom }: { id: string; from?: string }) {
  const { properties, property, can } = useStaysDesk(id);
  const today = istToday();
  const [from, setFrom] = useState(() => initialFrom ?? today);
  const [selected, setSelected] = useState<BedCell | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const days = useMemo(() => Array.from({ length: WEEK }, (_, i) => addDays(from, i)), [from]);
  const loaded = useLoad(() => Promise.all(days.map((d) => bedBoard(id, d))).then((boards) => ({ from, boards })), `${id}:${from}`);
  const boards = loaded.data?.from === from ? loaded.data.boards : null;
  const { reload } = loaded;
  const back = deskBack(property, id);

  useEffect(() => {
    window.history.replaceState(null, "", from === today ? `/beds/${id}` : `/beds/${id}?from=${from}`);
  }, [id, from, today]);

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
    setFrom(next);
    setSelected(null);
    setMessage(null);
  };
  const onTap = useCallback((cell: BedCell) => {
    setMessage(null);
    setSelected((now) => (now?.bedId === cell.bedId && now.day === cell.day ? null : cell));
  }, []);
  const done = (text: string) => {
    setMessage(text);
    reload();
  };

  const dayIndex = selected ? days.indexOf(selected.day) : 0;
  const dayBoard = boards?.[dayIndex >= 0 ? dayIndex : 0];
  const room = selected && dayBoard ? dayBoard.rooms.find((r) => r.id === selected.roomId) : undefined;
  const forbidden = loaded.error instanceof ApiError && (loaded.error.status === 403 || loaded.error.status === 404);
  const name = boards?.[0]?.property.name ?? property?.name ?? "Bed map";

  return (
    <div className={styles.deskPage}>
      <Back href={back.href}>{back.label}</Back>
      <div className={order.titleRow}>
        <h1 className={order.title}>{name}</h1>
        {property && !property.owner && <Tag>Warden</Tag>}
      </div>

      <div className={styles.dayNav}>
        <Button variant="secondary" icon={<Icon name="arrow-left" size={16} />} aria-label="Week before" onClick={() => goTo(addDays(from, -WEEK))} />
        <input type="date" aria-label="Week from" value={from} onChange={(e) => e.target.value && goTo(e.target.value)} />
        <Button variant="secondary" icon={<Icon name="arrow-right" size={16} />} aria-label="Next week" onClick={() => goTo(addDays(from, WEEK))} />
        {from !== today && (
          <Button variant="ghost" onClick={() => goTo(today)}>
            From today
          </Button>
        )}
        <span className={order.small} aria-live="polite">
          {`${dayShort(from)} – ${dayShort(addDays(from, WEEK - 1))}`}
        </span>
      </div>

      {loaded.error && !boards ? (
        forbidden ? (
          <Empty title="You can’t see this bed map">
            <p>Only the owner and wardens allowed to see reservations can open it.</p>
          </Empty>
        ) : (
          <div className={social.failed} role="alert">
            <p>{formError(loaded.error).message}</p>
            <Button variant="secondary" onClick={reload}>
              Try again
            </Button>
          </div>
        )
      ) : !boards ? (
        <Skeleton height={280} radius={16} />
      ) : !boards[0]?.rooms.length ? (
        <Empty title="No rooms yet">
          <p>Add rooms with their beds to the property, and they show up here.</p>
        </Empty>
      ) : (
        <>
          {dayBoard && (
            <>
              <span className={order.small}>{selected ? dayLong(selected.day) : from === today ? "Today" : dayLong(from)}</span>
              <Totals board={dayBoard} />
            </>
          )}
          <BedMap boards={boards} days={days} today={today} selected={selected} onTap={onTap} />
          <BedLegend />
          {message && (
            <p className={order.small} role="status">
              <Icon name="check" size={14} /> {message}
            </p>
          )}
          {selected && room && dayBoard ? (
            <BedPanel key={`${selected.bedId}:${selected.day}`} board={dayBoard} room={room} cell={selected} can={can} onDone={done} />
          ) : (
            !message && <Notice>Tap a bed on a day to see who has it, and to mark it full or free.</Notice>
          )}
        </>
      )}

      <ul className={order.rows}>
        <DeskLink href={`/beds/${id}/reservations`} icon="calendar" title="Reservations" line="Moving in soon, staying and past, with each tenant’s details" />
        <DeskLink href={`/beds/${id}/tenants`} icon="users" title="Tenants" line="Who lives here now, by room, with phone numbers and notice" />
        {can("stays.listing") && <DeskLink href={`/beds/${id}/prices`} icon="wallet" title="Room prices" line="Change each room’s price by the month or night" />}
        {can("stays.listing") && !property?.owner && <DeskLink href={`/beds/${id}/listing`} icon="edit" title="Edit the listing" line="Food, facilities, rules, deposit and nearby places" />}
      </ul>
      {properties.error != null && !property && <Notice>{`Couldn’t check what you can do here: ${formError(properties.error).message}`}</Notice>}
    </div>
  );
}
