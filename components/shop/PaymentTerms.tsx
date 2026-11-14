import { Icon } from "@/components/ui";
import type { Term } from "@/lib/api/terms";
import styles from "./order.module.css";

/** Payment conditions, one per line with an icon. Same as the app. */
export function PaymentTerms({ terms }: { terms: Term[] }) {
  return (
    <ul className={styles.terms}>
      {terms.map((term) => (
        <li key={term.text}>
          <span className={styles.termIcon}>
            <Icon name={term.icon} size={18} />
          </span>
          <span>{term.text}</span>
        </li>
      ))}
    </ul>
  );
}
