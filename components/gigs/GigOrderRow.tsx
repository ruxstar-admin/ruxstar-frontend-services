import Link from "next/link";
import { Icon, Tag } from "@/components/ui";
import type { GigOrder } from "@/lib/api/gigs";
import { money } from "@/lib/api/shops";
import { deadlineText, orderStatus } from "@/lib/gigs";
import { ago } from "@/lib/time";
import styles from "@/components/shop/order.module.css";

/** One freelance order in a list: what, with whom, how much, where it is and the next deadline. */
export function GigOrderRow({ href, order, subtitle, amount, now }: { href: string; order: GigOrder; subtitle: string; amount: number | null; now: number }) {
  const status = orderStatus(order);
  const deadline = deadlineText(order, now);
  return (
    <li>
      <Link href={href} className={styles.row}>
        <span className={styles.rowIcon}>
          <Icon name={order.quoteId ? "chat" : "briefcase"} size={20} />
        </span>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{order.title}</span>
          <span className={styles.faint}>{`#${order.orderNo} · ${subtitle} · ${ago(order.createdAt)}`}</span>
          {deadline && <span className={order.late ? styles.error : styles.faint}>{deadline}</span>}
        </span>
        <span className={styles.rowEnd}>
          {amount !== null && <strong>{money(amount)}</strong>}
          <Tag tone={status.tone}>{status.label}</Tag>
        </span>
      </Link>
    </li>
  );
}
