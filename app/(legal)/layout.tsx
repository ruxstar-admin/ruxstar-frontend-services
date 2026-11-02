import Link from "next/link";
import styles from "./legal.module.css";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link href="/" className="brand">
          <img src="/logo.svg" width={30} height={30} alt="" />
          <span>ruxstar</span>
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
