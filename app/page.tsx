import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { StarMark } from "@/components/brand/StarMark";
import { ButtonLink } from "@/components/ui";
import { Countdown } from "./countdown";
import styles from "./page.module.css";

/** Signed-in people go straight to their feed; everyone else sees the countdown. */
export default async function ComingSoon() {
  if ((await cookies()).has("rx_at")) redirect("/feed");

  return (
    <main className={styles.page}>
      <header className={styles.bar}>
        <div className="brand">
          <img src="/logo.svg" width={30} height={30} alt="" />
          <span>ruxstar</span>
        </div>
        <ButtonLink href="/signin?next=/feed" variant="ghost">
          Sign in
        </ButtonLink>
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
