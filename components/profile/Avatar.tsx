import styles from "./Avatar.module.css";

/**
 * The profile photo, or the first letter of the name on purple. `size` is pixels, or any CSS
 * length such as `var(--avatar)` when a stylesheet sets it per screen width.
 */
export function Avatar({ name, url, size = 48, busy = false }: { name: string; url?: string | null; size?: number | string; busy?: boolean }) {
  const fontSize = typeof size === "number" ? Math.round(size * 0.4) : `calc(${size} * 0.4)`;
  const pixels = typeof size === "number" ? size : undefined;
  return (
    <span className={styles.avatar} style={{ width: size, height: size, fontSize }} aria-busy={busy || undefined}>
      {url ? (
        <img src={url} alt="" width={pixels} height={pixels} />
      ) : (
        <span aria-hidden>{name.trim().charAt(0).toUpperCase()}</span>
      )}
      {busy && <span className={styles.busy} aria-hidden />}
    </span>
  );
}
