import type { Metadata } from "next";
import Link from "next/link";
import styles from "./auth.module.css";

export const metadata: Metadata = { robots: { index: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${styles.page} glow`}>
      <header className={styles.bar}>
        <Link href="/" className="brand">
          <img src="/logo.svg" width={30} height={30} alt="" />
          <span>ruxstar</span>
        </Link>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
