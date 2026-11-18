import styles from "./shots.module.css";

/**
 * A true-size piece of the Ruxstar app for the home page. It holds no links or buttons, so keyboard and screen-reader
 * users skip it; the text around it says the same.
 */

/** The app's store listing, until it is on Google Play. */
export function AppListing() {
  return (
    <div className={`${styles.ui} ${styles.listing}`} data-ui>
      <div className={styles.listingTop}>
        <img src="/logo.svg" width={64} height={64} alt="" loading="lazy" decoding="async" className={styles.appIcon} />
        <span className={styles.fileText}>
          <span className={styles.title}>Ruxstar</span>
          <span className={styles.meta}>Social marketplace for local businesses</span>
        </span>
      </div>
      <span className={`${styles.button} ${styles.buttonOff}`}>Coming soon to Google Play</span>
    </div>
  );
}
