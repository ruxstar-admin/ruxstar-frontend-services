import { ButtonLink } from "@/components/ui";
import styles from "../profile.module.css";

export default function ProfileNotFound() {
  return (
    <article className={styles.card}>
      <div className={styles.identity}>
        <h1 className={styles.name}>No one has that username</h1>
        <p className={styles.handle}>Check the spelling, or the account may have been deleted.</p>
      </div>
      <ButtonLink href="/" variant="secondary">
        Go to Ruxstar
      </ButtonLink>
    </article>
  );
}
