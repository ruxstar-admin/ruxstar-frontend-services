"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useCustomerBookings, useCustomerProfile, useNotifications } from "@/lib/swr-hooks";
export type CustomerView = "discover" | "print" | "commerce" | "orders" | "bookings" | "support" | "account";

const NAV: { id: CustomerView; label: string; icon: string; href: string }[] = [
  { id: "discover", label: "Discover", icon: "🔎", href: "/customer" },
  { id: "print", label: "Print", icon: "🖨️", href: "/customer/print" },
  { id: "commerce", label: "Commerce", icon: "🛍️", href: "/customer/commerce" },
  { id: "orders", label: "My orders", icon: "📦", href: "/customer/orders" },
  { id: "bookings", label: "My bookings", icon: "🎟️", href: "/customer?view=bookings" },
  { id: "support", label: "Support", icon: "💬", href: "/customer/support" },
  { id: "account", label: "Account", icon: "⚙", href: "/customer?view=account" },
];

function activeView(pathname: string, viewParam: string | null): CustomerView {
  if (pathname.startsWith("/customer/orders")) return "orders";
  if (pathname.startsWith("/customer/print")) return "print";
  if (pathname.startsWith("/customer/commerce")) return "commerce";
  if (pathname.startsWith("/customer/support")) return "support";
  if (pathname.startsWith("/customer/book")) return "discover";
  if (pathname.startsWith("/customer/creator")) return "discover";
  if (pathname.startsWith("/customer/events")) return "discover";
  if (viewParam === "bookings") return "bookings";
  if (viewParam === "account") return "account";
  return "discover";
}

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const view = activeView(pathname, viewParam);

  const { ready } = useRequireAuth({ roles: ["customer"] });
  const { data: profile } = useCustomerProfile(ready);
  const { data: bookings = [] } = useCustomerBookings(ready);
  const { data: notifications } = useNotifications(ready);
  const unreadNotifications = notifications?.unreadCount ?? 0;
  const [nowMs] = useState(() => Date.now());

  const upcomingCount = bookings.filter(
    (b) => new Date(b.startAt).getTime() > nowMs && b.status !== "cancelled",
  ).length;

  const initial = (profile?.name || "?").trim().charAt(0).toUpperCase();
  const mobileTitle = pathname.startsWith("/customer/payment-status")
    ? "Payment"
    : pathname.startsWith("/customer/notifications")
      ? "Notifications"
      : pathname.startsWith("/customer/book")
        ? "Book"
        : NAV.find((n) => n.id === view)?.label ?? "Discover";
  const isBookPage = pathname.startsWith("/customer/book");
  const isCustomerHub = pathname === "/customer";
  const isPrintFlow =
    pathname.startsWith("/customer/print") ||
    pathname.startsWith("/customer/commerce") ||
    pathname.startsWith("/customer/orders");
  const isSupport = pathname.startsWith("/customer/support");
  const isFixedViewport = isCustomerHub || isPrintFlow || isSupport;

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <p className="text-sm text-white/50">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#050505] text-[#ededef]">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-[#0a0a0b] lg:flex">
        <div className="flex items-start justify-between border-b border-white/5 px-5 py-6">
          <div>
            <span className="text-lg font-semibold tracking-tight">Ruxstar</span>
            <p className="mt-0.5 text-xs text-zinc-500">Book & manage</p>
          </div>
          <NotificationBell enabled={ready} pageHref="/customer/notifications" unread={unreadNotifications} />
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => router.push(item.href)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                view === item.id
                  ? "bg-white/10 text-zinc-100"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              <span className="w-5 text-center">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.id === "bookings" && upcomingCount > 0 && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  {upcomingCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-white/5 p-4">
          <div className="mb-3 flex items-center gap-2.5 px-1">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-sm font-semibold text-zinc-200">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm text-zinc-200">{profile?.name || "Account"}</p>
              {profile?.mobile && (
                <p className="truncate text-xs text-zinc-500">+91 {profile.mobile}</p>
              )}
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/5 bg-[#0a0a0b] px-4 py-4 lg:hidden">
          <span className="text-base font-semibold tracking-tight">Ruxstar</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">{mobileTitle}</span>
            <NotificationBell enabled={ready} pageHref="/customer/notifications" unread={unreadNotifications} />
            <LogoutButton />
          </div>
        </header>

        <main
          className={
            isFixedViewport
              ? "relative flex min-h-0 flex-1 flex-col overflow-hidden"
              : "relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
          }
        >
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="bg-grid absolute inset-0" />
            <div className="spotlight absolute inset-0" />
          </div>

          <div
            className={`mx-auto min-w-0 ${
              isBookPage
                ? "max-w-6xl px-0 pb-28 pt-3 lg:pb-12"
                : isPrintFlow
                  ? "flex h-full min-h-0 w-full max-w-none flex-1 flex-col px-0 pb-0 pt-0"
                : isFixedViewport
                  ? "flex h-full min-h-0 w-full max-w-5xl flex-1 flex-col px-5 pb-4 pt-6 sm:px-8 lg:pb-6 lg:pt-8"
                  : "max-w-5xl px-5 pb-28 pt-8 sm:px-8 lg:pb-12"
            }`}
          >
            {children}
          </div>
        </main>

        <nav className="flex shrink-0 border-t border-white/8 bg-[#0a0a0b] lg:hidden">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => router.push(item.href)}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition ${
                view === item.id ? "text-emerald-300" : "text-zinc-500"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === "bookings" && upcomingCount > 0 && (
                <span className="absolute right-[28%] top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

/** Small back link for nested customer routes (e.g. booking). */
export function CustomerBackLink({ href = "/customer", label = "← Discover" }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="mb-6 inline-block text-sm text-zinc-500 transition hover:text-zinc-300">
      {label}
    </Link>
  );
}
