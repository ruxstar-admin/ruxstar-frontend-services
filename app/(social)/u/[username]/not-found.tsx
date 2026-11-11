import { ButtonLink } from "@/components/ui";
import styles from "../profile.module.css";

export default function ProfileNotFound() {
  return (
    <article className={styles.missing}>
      <h1 className={styles.missingTitle}>No one has that username</h1>
      <p className={styles.missingText}>Check the spelling, or the account may have been deleted.</p>
      <ButtonLink href="/" variant="secondary">
        Go to Ruxstar
      </ButtonLink>
    </article>
  );
}
