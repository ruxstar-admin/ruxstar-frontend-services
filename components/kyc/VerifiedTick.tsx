import { Icon } from "@/components/ui";
import styles from "./kyc.module.css";

/** Beside a name: Ruxstar has checked this person's Aadhaar, PAN and face. */
export function VerifiedTick({ size = 18 }: { size?: number }) {
  return (
    <span className={styles.tick} title="Verified by Ruxstar">
      <Icon name="verified" size={size} label="Verified" />
    </span>
  );
}
