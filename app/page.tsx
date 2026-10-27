import { StarMark } from "@/components/brand/StarMark";
import { Countdown } from "./countdown";
import styles from "./page.module.css";

export default function ComingSoon() {
  return (
    <main className={`${styles.page} glow`}>
      <header className={styles.bar}>
        <div className="brand">
          <img src="/logo.svg" width={30} height={30} alt="" />
          <span>ruxstar</span>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.copy}>
          <h1 className={styles.title}>
            <span className={styles.line}>
              <span>We go live on</span>
            </span>
            <span className={styles.line}>
              <span>30 November</span>
            </span>
          </h1>
          <p className={styles.lede}>
            Print, events, coaching and stays from the people around you, in one place on the web and in the app.
          </p>
          <Countdown />
        </div>
        <div className={styles.stage}>
          <StarMark className={styles.mark} />
        </div>
      </section>

      <footer className={styles.foot}>© 2026 Ruxstar</footer>
    </main>
  );
}
