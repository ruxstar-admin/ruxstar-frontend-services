"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { chatUnread, type ChatUnread } from "@/lib/api/chats";

const REFRESH_MS = 15_000;
const NONE: ChatUnread = { unread: 0, requests: 0 };

/** Unread messages and requests: every 15 seconds while the page is in view, and on every page change. */
export function useChatUnread(signedIn: boolean): ChatUnread {
  const pathname = usePathname();
  const [counts, setCounts] = useState(NONE);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    const load = () => document.visibilityState === "visible" && chatUnread().then((c) => live && setCounts(c), () => undefined);
    load();
    const timer = setInterval(load, REFRESH_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [signedIn, pathname]);

  return signedIn ? counts : NONE;
}
