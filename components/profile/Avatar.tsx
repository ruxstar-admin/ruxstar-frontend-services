import styles from "./Avatar.module.css";

/** The profile photo, or the first letter of the name on purple. */
export function Avatar({ name, url, size = 48, busy = false }: { name: string; url?: string | null; size?: number; busy?: boolean }) {
  return (
    <span className={styles.avatar} style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-busy={busy || undefined}>
      {url ? (
        <img src={url} alt="" width={size} height={size} />
      ) : (
        <span aria-hidden>{name.trim().charAt(0).toUpperCase()}</span>
      )}
      {busy && <span className={styles.busy} aria-hidden />}
    </span>
  );
}
