export type TextPart =
  | { kind: "text"; text: string }
  | { kind: "mention"; text: string; username: string }
  | { kind: "link"; text: string; url: string };

// The same @username rule the API uses to tell people they were mentioned: not inside an email, 3–20 of a–z 0–9 . _
const TOKEN = /(^|[^a-z0-9_.@])@([a-z0-9_.]{3,20})|\b(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi;
const LINK_TAIL = /[.,!?;:)\]'"]+$/;
const NAME_TAIL = /[._]+$/;

/** Splits post or comment text into plain runs, @mentions and web links, in order. Same as the app. */
export function richText(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let plain = "";
  const flush = () => {
    if (plain) parts.push({ kind: "text", text: plain });
    plain = "";
  };
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    plain += text.slice(last, start);
    last = start + match[0].length;
    const [, prefix = "", name, link] = match;
    if (link) {
      const shown = link.replace(LINK_TAIL, "");
      if (/^(https?:\/\/|www\.)[^./]+\.[^.]/i.test(shown)) {
        flush();
        parts.push({ kind: "link", text: shown, url: /^www\./i.test(shown) ? `https://${shown}` : shown });
        plain += link.slice(shown.length);
      } else {
        plain += link;
      }
      continue;
    }
    plain += prefix;
    const username = name!.replace(NAME_TAIL, "");
    if (username.length >= 3) {
      flush();
      parts.push({ kind: "mention", text: `@${username}`, username: username.toLowerCase() });
      plain += name!.slice(username.length);
    } else {
      plain += `@${name}`;
    }
  }
  plain += text.slice(last);
  flush();
  return parts;
}
