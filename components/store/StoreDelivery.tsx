"use client";

import { useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { Button, Icon } from "@/components/ui";
import { RiderCard } from "@/components/shop/OrderParts";
import { formError } from "@/lib/api/account";
import { newIdempotencyKey } from "@/lib/api/client";
import { tripActive, vehicleLine } from "@/lib/api/orders";
import { money } from "@/lib/api/shops";
import { assignDeskDelivery, cancelDeskDelivery, deskDeliveryOptions, type AssignChoice, type DeliveryOptions, type DeskOrder } from "@/lib/api/store";
import { exact } from "@/lib/time";
import styles from "@/components/shop/order.module.css";

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

/**
 * Who takes a packed order to the customer: the shop itself (with the buttons above), someone on the team, or a Ruxstar
 * partner. The same choices as print orders, for local shop orders.
 */
export function StoreDelivery({ order, canManage, onChanged }: { order: DeskOrder; canManage: boolean; onChanged: (order: DeskOrder) => void }) {
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

  const fail = (err: unknown) => {
    if (!onSignedOut(err)) setError(formError(err).message);
  };

  const open = async () => {
    setPicking(true);
    setError(null);
    setLoading(true);
    try {
      setOptions(await deskDeliveryOptions(order.id));
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  };

  const assign = async (choice: AssignChoice) => {
    setSending(choice.carrier === "team" ? choice.placeId : "partner");
    setError(null);
    try {
      const next = await assignDeskDelivery(order.id, choice, key.current);
      key.current = newIdempotencyKey();
      setPicking(false);
      onChanged(next);
    } catch (err) {
      fail(err);
    } finally {
      setSending(null);
    }
  };

  const cancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      onChanged(await cancelDeskDelivery(order.id));
    } catch (err) {
      fail(err);
    } finally {
      setCancelling(false);
    }
  };

  if (order.method !== "delivery" || (!live && order.status !== "packed")) return null;

  const note = !delivery
    ? undefined
    : delivery.status === "offered" && delivery.carrier === "partner"
      ? `Offered to Ruxstar partners nearby until ${delivery.offerUntil ? exact(delivery.offerUntil) : "soon"}. The first to accept gets it.`
      : delivery.status === "offered"
        ? "Waiting for them to accept in the Ruxstar Delivery app."
        : delivery.carrier === "partner" && delivery.pay
          ? `${money(delivery.pay)} of your share goes to the partner when it is delivered.`
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
              : "Take it yourself with Out for delivery above, or send someone on your team or a Ruxstar partner."}
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
