"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Input } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { GateCamera } from "@/components/events/GateCamera";
import { formError } from "@/lib/api/account";
import { checkInTicket, getDeskEvent, lookupTickets, scanTicket, type DeskCounts, type DeskEvent, type LookupTicket, type ScanResult } from "@/lib/api/events";
import { dayLabel, lookupKind, OUTCOME, timeText } from "@/lib/events";
import order from "@/components/shop/order.module.css";
import styles from "@/components/events/events.module.css";

/** How often the live count refreshes. */
const POLL_MS = 10_000;
/** The same QR held in front of the camera is read many times a second; it counts once in this window. */
const REPEAT_MS = 4000;
/** The result stays up this long, then the gate goes back to "ready". */
const PANEL_MS = 8000;

interface Panel {
  tone: "success" | "warning" | "danger";
  title: string;
  message: string;
  who: string | null;
}

const whoOf = (t: ScanResult["ticket"]) => (t ? [t.name, t.team, t.tier, t.code].filter(Boolean).join(" · ") : null);
const fromResult = (res: ScanResult): Panel => ({ ...OUTCOME[res.result], message: res.message, who: whoOf(res.ticket) });

function Lookup({ eventId, onResult, onClose }: { eventId: string; onResult: (res: ScanResult) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<LookupTicket[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    const kind = lookupKind(query);
    setError(null);
    if (!kind) {
      setError("Type the six letters on the ticket, or a 10-digit mobile number.");
      return;
    }
    setSearching(true);
    try {
      setFound(await lookupTickets(eventId, "code" in kind ? kind.code : kind.phone));
    } catch (err) {
      setError(formError(err).message);
    } finally {
      setSearching(false);
    }
  };

  const letIn = async (ticket: LookupTicket) => {
    setCheckingIn(ticket.id);
    setError(null);
    try {
      onResult(await checkInTicket(eventId, ticket.id));
    } catch (err) {
      setError(formError(err).message);
      setCheckingIn(null);
    }
  };

  return (
    <section className={order.news} aria-label="Find a ticket">
      <strong>Find a ticket</strong>
      <form
        className={styles.lookup}
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <Input
          label="Code or mobile"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ABC123 or 98xxxxxxxx"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          hint={error ? undefined : "The six letters under the QR code, or the ticket holder’s mobile."}
          error={error ?? undefined}
        />
        <Button type="submit" loading={searching}>
          Find
        </Button>
      </form>
      {found && !found.length && <p className={order.small}>No ticket for this event matches.</p>}
      {found && found.length > 0 && (
        <ul className={styles.tiers}>
          {found.map((t) => (
            <li key={t.id} className={styles.tierRow}>
              <span className={styles.tierText}>
                <span className={styles.tierName}>{t.name}</span>
                <span className={order.small}>{[t.team, t.tier, t.code, t.phone].filter(Boolean).join(" · ")}</span>
                {t.status !== "valid" ? (
                  <span className={order.error}>Cancelled</span>
                ) : t.inToday ? (
                  <span className={styles.seats} data-low>{`Inside since ${timeText(t.inToday)}`}</span>
                ) : null}
              </span>
              {t.status === "valid" && !t.inToday && (
                <Button loading={checkingIn === t.id} disabled={!!checkingIn && checkingIn !== t.id} onClick={() => void letIn(t)}>
                  Let in
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </section>
  );
}

/**
 * The gate on the web: scan with the camera where the browser can read QR codes, or type a code or phone and let them
 * in. Green, amber or red, the same as the app. The count refreshes every 10 seconds. No offline mode here: the app has it.
 */
export function GateScreen({ id }: { id: string }) {
  const onSignedOut = useOnSignedOut();
  const [event, setEvent] = useState<DeskEvent | null>(null);
  const [counts, setCounts] = useState<DeskCounts | null>(null);
  const [fatal, setFatal] = useState<unknown>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [checking, setChecking] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const panelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef({ data: "", at: 0 });
  const busy = useRef(false);

  const refresh = useCallback(
    () =>
      getDeskEvent(id).then(
        (next) => {
          setEvent(next);
          setCounts(next.counts);
          setFatal(null);
        },
        (err: unknown) => {
          if (onSignedOut(err)) return;
          setEvent((current) => {
            if (!current) setFatal(err);
            return current;
          });
        },
      ),
    [id, onSignedOut],
  );

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => document.visibilityState === "visible" && void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(
    () => () => {
      if (panelTimer.current) clearTimeout(panelTimer.current);
    },
    [],
  );

  const show = useCallback((next: Panel) => {
    setPanel(next);
    if (panelTimer.current) clearTimeout(panelTimer.current);
    panelTimer.current = setTimeout(() => setPanel(null), PANEL_MS);
  }, []);

  const take = useCallback(
    (res: ScanResult) => {
      setCounts(res.counts);
      show(fromResult(res));
    },
    [show],
  );

  const onRead = useCallback(
    (data: string) => {
      const now = Date.now();
      if (busy.current || (data === last.current.data && now - last.current.at < REPEAT_MS)) return;
      last.current = { data, at: now };
      busy.current = true;
      setChecking(true);
      scanTicket(id, data)
        .then(take, (err: unknown) => show({ tone: "danger", title: "Couldn’t check", message: formError(err).message, who: null }))
        .finally(() => {
          busy.current = false;
          setChecking(false);
        });
    },
    [id, take, show],
  );

  if (!event) {
    if (fatal) {
      return (
        <Empty title="Can’t open this gate">
          <p>{formError(fatal).message}</p>
          <div className={order.actions}>
            <Button variant="secondary" icon={<Icon name="refresh" size={16} />} onClick={() => void refresh()}>
              Try again
            </Button>
            <ButtonLink href="/gate" variant="ghost">
              All gates
            </ButtonLink>
          </div>
        </Empty>
      );
    }
    return (
      <div className={order.page} aria-busy>
        <div className={styles.count} />
      </div>
    );
  }

  return (
    <div className={order.page}>
      <div>
        <ButtonLink href="/gate" variant="ghost" icon={<Icon name="arrow-left" size={16} />}>
          All gates
        </ButtonLink>
      </div>
      <h1 className={order.title}>{event.title}</h1>

      <div className={styles.count} aria-live="polite">
        <span className={styles.countBig}>{`${counts?.inToday ?? 0} in`}</span>
        <span className={order.small}>{`of ${counts?.tickets ?? 0} tickets${event.today ? " today" : ""}`}</span>
      </div>
      {!event.today && <p className={styles.seats} data-low>{`Check-ins open on ${event.days.map(dayLabel).join(", ")}. Scans today show red.`}</p>}

      {panel ? (
        <div className={styles.outcome} data-tone={panel.tone} role="alert">
          <span className={styles.outcomeTitle}>{panel.title}</span>
          {panel.who && <strong>{panel.who}</strong>}
          <span>{panel.message}</span>
          <div>
            <Button variant="secondary" onClick={() => setPanel(null)}>
              Next ticket
            </Button>
          </div>
        </div>
      ) : (
        checking && <p className={order.small}>Checking…</p>
      )}

      <GateCamera onRead={onRead} paused={!!panel || lookupOpen} />

      {lookupOpen ? (
        <Lookup
          eventId={id}
          onClose={() => setLookupOpen(false)}
          onResult={(res) => {
            setLookupOpen(false);
            take(res);
          }}
        />
      ) : (
        <div className={order.actions}>
          <Button variant="secondary" icon={<Icon name="search" size={16} />} onClick={() => setLookupOpen(true)}>
            Type code or phone
          </Button>
          {event.canSeeGuests && (
            <ButtonLink href={`/gate/${id}/guests`} variant="secondary" icon={<Icon name="users" size={16} />}>
              Guest list
            </ButtonLink>
          )}
        </div>
      )}
    </div>
  );
}
