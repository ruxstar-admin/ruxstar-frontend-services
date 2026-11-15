import type { ReactNode } from "react";
import { Icon, Tag } from "@/components/ui";
import { PriceLine } from "@/components/stays/pieces";
import { money } from "@/lib/api/shops";
import type { OrderLine, OrderRefund, OrderReturn, StoreOrder } from "@/lib/api/store-types";
import { offerWord } from "@/lib/coupons";
import { momentText, optionsText, plural, RETURN_REASON, RETURN_STATUS } from "@/lib/store";
import order from "@/components/shop/order.module.css";
import styles from "./store.module.css";

/** What was bought: photo, title, options, how many and the line's price. */
export function OrderLines({ lines, showSku = false }: { lines: OrderLine[]; showSku?: boolean }) {
  return (
    <ul className={styles.lines}>
      {lines.map((l) => (
        <li key={l.id} className={styles.line}>
          <span className={styles.thumb}>{l.photoUrl ? <img src={l.photoUrl} width={64} height={64} alt="" loading="lazy" decoding="async" /> : <Icon name="bag" size={24} />}</span>
          <span className={styles.lineText}>
            <span className={styles.lineTitle}>{l.title}</span>
            {l.options.length > 0 && <span className={order.small}>{optionsText(l.options)}</span>}
            <span className={order.small}>{`${money(l.unitPrice)} × ${l.quantity}${showSku && l.sku ? ` · SKU ${l.sku}` : ""}`}</span>
          </span>
          <span className={styles.lineEnd}>
            <strong>{money(l.total)}</strong>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Items, delivery, fee, offer and total; then what went back. */
export function OrderPrice({ o, after }: { o: Pick<StoreOrder, "orderNo" | "price" | "coupon" | "method" | "status" | "refunded" | "business">; after?: ReactNode }) {
  const unpaid = o.status === "awaiting_payment";
  return (
    <div className={order.panel}>
      <span className={order.faint}>{`Order #${o.orderNo}`}</span>
      <dl className={order.prices}>
        <PriceLine label="Items" amount={o.price.items} />
        {o.method === "delivery" && <PriceLine label={o.price.deliveryKm !== null ? `Delivery (${o.price.deliveryKm} km)` : "Delivery"} amount={o.price.delivery} />}
        {o.price.platformFee > 0 && <PriceLine label="Platform fee" amount={o.price.platformFee} />}
        {o.price.discount > 0 && (
          <PriceLine label={o.coupon ? `Coupon ${o.coupon.code} · ${offerWord(o.coupon.fundedBy, "shop")}` : "Discount"} amount={o.price.discount} minus />
        )}
        <PriceLine label={unpaid ? "To pay" : "Paid"} amount={o.price.total} strong />
        {o.refunded > 0 && <PriceLine label="Refunded" amount={o.refunded} minus />}
      </dl>
      {after}
    </div>
  );
}

export function RefundLines({ refunds }: { refunds: OrderRefund[] }) {
  if (!refunds.length) return null;
  return (
    <>
      {refunds.map((r, i) => (
        <div key={`${r.at}-${i}`} className={order.news}>
          <p className={order.small}>
            {r.status === "done"
              ? `${money(r.amount)} refunded to how you paid${r.kind === "return" ? " for the return" : ""}. Banks take up to 7 days to show it.`
              : `Refunding ${money(r.amount)}${r.kind === "return" ? " for the return" : ""}…`}
          </p>
        </div>
      ))}
    </>
  );
}

/** A return: why, what goes back, who pays the trip, what comes back and the shop's answer. */
export function ReturnCard({ ret, lines, forShop = false }: { ret: OrderReturn; lines: OrderLine[]; forShop?: boolean }) {
  const word = RETURN_STATUS[ret.status];
  const back = ret.lines.map((p) => {
    const line = lines.find((l) => l.id === p.lineId);
    return line ? `${line.title}${line.options.length ? ` (${optionsText(line.options)})` : ""} × ${p.quantity}` : plural(p.quantity, "item");
  });
  const trip =
    ret.tripPaidBy === "shop"
      ? forShop
        ? "Your shop pays for the trip back."
        : "The shop pays for the trip back."
      : ret.tripFee > 0
        ? `${money(ret.tripFee)} for the trip back comes off the refund.`
        : null;
  return (
    <div className={order.news} role="status">
      <div className={order.titleRow}>
        <strong>{forShop ? "Return asked" : "Your return"}</strong>
        <Tag tone={word.tone}>{word.label}</Tag>
      </div>
      <p className={order.small}>{`${RETURN_REASON[ret.reason]} · ${momentText(ret.requestedAt)}`}</p>
      {ret.note && <p className={order.small}>{`“${ret.note}”`}</p>}
      <p className={order.small}>{`Going back: ${back.join(", ")}`}</p>
      {trip && <p className={order.small}>{trip}</p>}
      <p className={order.small}>{`${forShop ? "Refund to the customer" : "Refund"}: ${money(ret.amount)}`}</p>
      {ret.decision && (
        <p className={order.small}>
          {`${ret.decision.by === "staff" ? "Ruxstar" : forShop ? "You" : "The shop"} ${ret.status === "rejected" ? "turned it down" : "accepted it"} · ${momentText(ret.decision.at)}`}
          {ret.decision.note ? `: ${ret.decision.note}` : ""}
        </p>
      )}
      {ret.receivedAt && <p className={order.small}>{`Back at the shop · ${momentText(ret.receivedAt)}`}</p>}
    </div>
  );
}
