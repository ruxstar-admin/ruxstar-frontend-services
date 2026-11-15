"use client";

import Link from "next/link";
import { Icon } from "@/components/ui";
import { Stepper } from "@/components/stays/pieces";
import { money } from "@/lib/api/shops";
import { optionsText, stockLine } from "@/lib/store";
import { MAX_QUANTITY, setQuantity, type CartItem } from "./cart";
import order from "@/components/shop/order.module.css";
import styles from "./store.module.css";

/** The cart's lines: photo, title and options, the price, a quantity stepper and Remove. `stock` comes from the latest quote. */
export function CartLines({ items, stock, editable = true }: { items: CartItem[]; stock?: Map<string, number>; editable?: boolean }) {
  return (
    <ul className={styles.lines}>
      {items.map((item) => {
        const left = stock?.get(item.variantId);
        const warn = left !== undefined ? (left < item.quantity ? (left <= 0 ? "Sold out" : `Only ${left} left`) : stockLine(left)) : null;
        return (
          <li key={item.variantId} className={styles.line}>
            <span className={styles.thumb}>{item.photoUrl ? <img src={item.photoUrl} width={64} height={64} alt="" loading="lazy" decoding="async" /> : <Icon name="bag" size={24} />}</span>
            <span className={styles.lineText}>
              <Link href={`/products/${item.productId}`} className={styles.lineTitle}>
                {item.title}
              </Link>
              {item.options.length > 0 && <span className={order.small}>{optionsText(item.options)}</span>}
              <span className={order.small}>
                {money(item.price)}
                {item.mrp && item.mrp > item.price ? (
                  <>
                    {" "}
                    <s className={order.faint}>{money(item.mrp)}</s>
                  </>
                ) : null}
                {!editable && ` × ${item.quantity}`}
              </span>
              {warn && <span className={left !== undefined && left < item.quantity ? order.error : styles.low}>{warn}</span>}
            </span>
            <span className={styles.lineEnd}>
              <strong>{money(item.price * item.quantity)}</strong>
              {editable && (
                <>
                  <Stepper
                    value={item.quantity}
                    min={1}
                    max={Math.max(1, Math.min(MAX_QUANTITY, left ?? MAX_QUANTITY))}
                    onChange={(n) => setQuantity(item.variantId, n)}
                    label={`of ${item.title}`}
                  />
                  <button type="button" className={order.remove} aria-label={`Remove ${item.title}`} onClick={() => setQuantity(item.variantId, 0)}>
                    <Icon name="trash" size={16} />
                  </button>
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
