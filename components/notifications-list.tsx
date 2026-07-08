"use client";

import { useRouter } from "next/navigation";
import {
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api";
import { invalidateNotifications, useNotifications } from "@/lib/swr-hooks";

type Props = {
  /** Resolve where a notification should navigate when tapped. */
  getHref?: (n: AppNotification) => string | null;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function NotificationsList({ getHref }: Props) {
  const router = useRouter();
  const { data, isLoading } = useNotifications(true);
  const notifications = data?.notifications ?? [];
  const unread = data?.unreadCount ?? 0;

  async function onItemClick(n: AppNotification) {
    if (!n.read) {
      void markNotificationRead(n.id).then(() => invalidateNotifications());
    }
    const href = getHref?.(n) ?? null;
    if (href) router.push(href);
  }

  async function onMarkAll() {
    await markAllNotificationsRead();
    invalidateNotifications();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            <span className="text-gradient">Notifications</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {unread > 0 ? `${unread} unread` : "You're all caught up."}
          </p>
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={onMarkAll}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-emerald-300 transition hover:bg-white/5"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="mt-6">
        {isLoading && notifications.length === 0 ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-12 text-center">
            <p className="text-3xl">🔔</p>
            <p className="mt-3 text-sm text-zinc-400">No notifications yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => {
              const href = getHref?.(n) ?? null;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onItemClick(n)}
                    className={`flex w-full flex-col items-start gap-1 rounded-2xl border px-4 py-3.5 text-left transition hover:bg-white/[0.04] ${
                      n.read
                        ? "border-white/8 bg-white/[0.02]"
                        : "border-emerald-400/20 bg-emerald-500/[0.05]"
                    }`}
                  >
                    <div className="flex w-full items-center gap-2">
                      {!n.read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                      )}
                      <span className="flex-1 truncate text-sm font-medium text-zinc-100">
                        {n.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-zinc-500">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    {n.body && (
                      <p className="text-sm leading-relaxed text-zinc-400">{n.body}</p>
                    )}
                    {href && (
                      <span className="mt-0.5 text-xs text-emerald-300/80">View →</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
