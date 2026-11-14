import Link from "next/link";
import { Fragment, useMemo } from "react";
import { richText } from "@/lib/rich-text";
import styles from "./social.module.css";

/**
 * Post, comment or chat text with @mentions linking to that person's profile and web links opening in a new tab.
 * `inline` renders a span, for text inside a chat bubble; `linkClassName` suits links to the background.
 */
export function PostText({ text, className, inline, linkClassName }: { text: string; className?: string; inline?: boolean; linkClassName?: string }) {
  const parts = useMemo(() => richText(text), [text]);
  const Tag = inline ? "span" : "p";
  const link = linkClassName ? `${styles.richLink} ${linkClassName}` : styles.richLink;
  return (
    <Tag className={className}>
      {parts.map((part, i) =>
        part.kind === "text" ? (
          <Fragment key={i}>{part.text}</Fragment>
        ) : part.kind === "mention" ? (
          <Link key={i} href={`/u/${part.username}`} className={link}>
            {part.text}
          </Link>
        ) : (
          <a key={i} href={part.url} target="_blank" rel="noopener noreferrer nofollow ugc" className={link}>
            {part.text}
          </a>
        ),
      )}
    </Tag>
  );
}
