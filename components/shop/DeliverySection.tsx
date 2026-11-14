"use client";

import { useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { Button, Icon } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { tripActive, vehicleLine, type AssignChoice, type DeliveryOptions, type ShopOrder, type TeamOrder } from "@/lib/api/orders";
import { money } from "@/lib/api/shops";
import { exact } from "@/lib/time";
import { RiderCard } from "./OrderParts";
import styles from "./order.module.css";

/** The delivery calls of the owner's orders or the team's. */
export interface DeliveryDesk<T extends ShopOrder | TeamOrder> {
  deliveryOptions: (id: string) => Promise<DeliveryOptions>;
  assign: (id: string, choice: AssignChoice, idempotencyKey: string) => Promise<T>;
  cancelDelivery: (id: string) => Promise<T>;
}

interface DeliverySectionProps<T extends ShopOrder | TeamOrder> {
  order: T;
  desk: DeliveryDesk<T>;
  /** "Accept and move orders": picking who delivers and cancelling it. */
  canManage: boolean;
  onChanged: (order: T) => void;
}

function Choice({ icon, title, line, disabled, busy, onClick }: { icon: ReactNode; title: string; line: string; disabled: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button type="button" className={styles.choice} disabled={disabled} onClick={onClick}>
      <span className={styles.choiceIcon}>{icon}</span>
      <span className={styles.fileText}>
        <strong>{title}</strong>
        <span className={styles.small}>{line}</span>
      </span>
      {busy ? <span className={styles.spinner} aria-label="Sending" /> : <Icon name="chevron-right" size={18} />}
    </button>
  );
}

/** Who takes a ready order to the customer: the shop itself, someone on the team, or a Ruxstar partner. Same as the app. */
export function DeliverySection<T extends ShopOrder | TeamOrder>({ order, desk, canManage, onChanged }: DeliverySectionProps<T>) {
  const onSignedOut = useOnSignedOut();
  const [picking, setPicking] = useState(false);
  const [options, setOptions] = useState<DeliveryOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());
  const { delivery } = order;
  const live = tripActive(delivery);

  const fail = (err: unknown, fallback: string) => {
    if (onSignedOut(err)) return;
    setError(err instanceof ApiError ? formError(err).message : fallback);
  };

  const open = async () => {
    setPicking(true);
    setError(null);
    setLoading(true);
    try {
      setOptions(await desk.deliveryOptions(order.id));
    } catch (err) {
      fail(err, "Could not load who can deliver. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const assign = async (choice: AssignChoice) => {
    setSending(choice.carrier === "team" ? choice.placeId : "partner");
    setError(null);
    try {
      const next = await desk.assign(order.id, choice, key.current);
      key.current = newIdempotencyKey();
      setPicking(false);
      onChanged(next);
    } catch (err) {
      fail(err, "Could not send it. Try again.");
    } finally {
      setSending(null);
    }
  };

  const cancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      onChanged(await desk.cancelDelivery(order.id));
    } catch (err) {
      fail(err, "Could not cancel the delivery. Try again.");
    } finally {
      setCancelling(false);
    }
  };

  if (!live && order.status !== "ready") return null;

  const note = !delivery
    ? undefined
    : delivery.status === "offered" && delivery.carrier === "partner"
      ? `Offered to Ruxstar partners nearby until ${delivery.offerUntil ? exact(delivery.offerUntil) : "soon"}. The first to accept gets it.`
      : delivery.status === "offered"
        ? "Waiting for them to accept in the Ruxstar Delivery app."
        : delivery.carrier === "partner" && delivery.pay
          ? `${money(delivery.pay)} of the shop's share goes to the partner when it is delivered.`
          : undefined;

  return (
    <section className={styles.section}>
      <h2 className={styles.overline}>Delivery</h2>
      {live && delivery ? (
        <>
          <RiderCard delivery={delivery} note={note} />
          {canManage && delivery.status !== "picked_up" && (
            <div className={styles.actions}>
              <Button variant="ghost" loading={cancelling} onClick={() => void cancel()}>
                Cancel this delivery
              </Button>
            </div>
          )}
        </>
      ) : picking ? (
        <div className={`${styles.news} ${styles.picker}`}>
          <strong>Who delivers?</strong>
          {loading && <span className={styles.spinner} role="status" aria-label="Loading" />}
          {options && (
            <>
              {options.reason && <p className={styles.small}>{options.reason}</p>}
              <h3 className={styles.overline}>Your team</h3>
              {options.team.length ? (
                <div className={styles.choices}>
                  {options.team.map((person) => (
                    <Choice
                      key={person.placeId}
                      icon={<Avatar name={person.name} url={person.avatarUrl} size={40} />}
                      title={person.name}
                      line={person.vehicle ? vehicleLine(person.vehicle) : "Needs delivery verification, from the delivery icon on their profile"}
                      disabled={!options.canAssign || !person.ready || !!sending}
                      busy={sending === person.placeId}
                      onClick={() => void assign({ carrier: "team", placeId: person.placeId })}
                    />
                  ))}
                </div>
              ) : (
                <p className={styles.small}>Nobody on your team delivers yet. Give someone Deliver orders in Team.</p>
              )}
              <h3 className={styles.overline}>Ruxstar partner</h3>
              <Choice
                icon={<Icon name="bicycle" size={28} />}
                title={`Ruxstar partner · ${money(options.partner.pay)}`}
                line={
                  options.partner.reason ??
                  `${options.partner.distanceKm ? `About ${options.partner.distanceKm} km. ` : ""}${options.partner.online} online nearby. Paid from your share at delivery.`
                }
                disabled={!options.canAssign || !options.partner.available || !!sending}
                busy={sending === "partner"}
                onClick={() => void assign({ carrier: "partner" })}
              />
            </>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <Button variant="secondary" disabled={!!sending} onClick={() => setPicking(false)}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className={`${styles.panel} ${styles.picker}`}>
          <strong>Who delivers?</strong>
          <p className={styles.small}>
            {delivery?.status === "cancelled"
              ? "The last delivery was handed back. Pick who takes it now."
              : "Deliver it yourself with the buttons above, or send someone on your team or a Ruxstar partner."}
          </p>
          {canManage && (
            <div className={styles.actions}>
              <Button variant="secondary" icon={<Icon name="bicycle" size={18} />} onClick={() => void open()}>
                Send with a rider
              </Button>
            </div>
          )}
        </div>
      )}
      {error && !picking && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
