import Link from "next/link";
import { Icon, Tag } from "@/components/ui";
import { money } from "@/lib/api/shops";
import type { OrderLine, OrderReturn, StoreOrderStatus } from "@/lib/api/store-types";
import { DESK_STATUS, itemsText, linesTitle, RETURN_STATUS, STATUS } from "@/lib/store";
import { ago } from "@/lib/time";
import styles from "@/components/shop/order.module.css";

/** One shop order in a list: what was bought, the order number, when, and where it is. An open return shows instead of Delivered. */
export function StoreOrderRow({
  href,
  order,
  subtitle,
  amount,
  forShop = false,
}: {
  href: string;
  order: { orderNo: number; status: StoreOrderStatus; lines: Pick<OrderLine, "title" | "quantity">[]; method: "delivery" | "pickup"; createdAt: string; return: Pick<OrderReturn, "status"> | null };
  subtitle: string;
  amount: number | null;
  forShop?: boolean;
}) {
  const word = order.return ? RETURN_STATUS[order.return.status] : (forShop ? DESK_STATUS : STATUS)[order.status];
  return (
    <li>
      <Link href={href} className={styles.row}>
        <span className={styles.rowIcon}>
          <Icon name={order.method === "pickup" ? "store" : "bag"} size={20} />
        </span>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{`${linesTitle(order.lines)} · #${order.orderNo}`}</span>
          <span className={styles.faint}>{`${subtitle} · ${itemsText(order.lines)} · ${order.method === "pickup" ? "Pickup" : "Delivery"} · ${ago(order.createdAt)}`}</span>
        </span>
        <span className={styles.rowEnd}>
          {amount !== null && <strong>{money(amount)}</strong>}
          <Tag tone={word.tone}>{word.label}</Tag>
        </span>
      </Link>
    </li>
  );
}
