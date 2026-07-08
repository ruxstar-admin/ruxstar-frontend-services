"use client";

import { useRouter } from "next/navigation";
import { useNotifications } from "@/lib/swr-hooks";

type Props = {
  enabled?: boolean;
  /** When set, skips the SWR hook (use a single fetch in the parent shell). */
  unread?: number;
  /** Full-page notifications route to open when the bell is tapped. */
  pageHref: string;
};

/** Bell button in shell headers — opens the full Notifications page. */
export function NotificationBell({ enabled = true, unread: unreadProp, pageHref }: Props) {
  const router = useRouter();
  const { data } = useNotifications(enabled && unreadProp === undefined);
  const unread = unreadProp ?? data?.unreadCount ?? 0;

  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={() => router.push(pageHref)}
      className="relative grid h-9 w-9 place-items-center rounded-full border border-white/10 text-zinc-300 transition hover:bg-white/5"
      aria-label="Notifications"
    >
      <span className="text-base leading-none">🔔</span>
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-black">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}
