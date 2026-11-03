import Link from "next/link";
import styles from "./profile.module.css";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
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
