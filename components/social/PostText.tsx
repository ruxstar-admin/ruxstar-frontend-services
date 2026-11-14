import Link from "next/link";
import { Fragment, useMemo } from "react";
import { richText } from "@/lib/rich-text";
import styles from "./social.module.css";

/** Post or comment text with @mentions linking to that person's profile and web links opening in a new tab. */
export function PostText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => richText(text), [text]);
  return (
    <p className={className}>
      {parts.map((part, i) =>
        part.kind === "text" ? (
          <Fragment key={i}>{part.text}</Fragment>
        ) : part.kind === "mention" ? (
          <Link key={i} href={`/u/${part.username}`} className={styles.richLink}>
            {part.text}
          </Link>
        ) : (
          <a key={i} href={part.url} target="_blank" rel="noopener noreferrer nofollow ugc" className={styles.richLink}>
            {part.text}
          </a>
        ),
      )}
    </p>
  );
}
