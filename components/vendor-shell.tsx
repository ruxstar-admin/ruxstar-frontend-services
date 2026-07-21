"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useVendorKyc, useNotifications } from "@/lib/swr-hooks";
import {
  getVendorKycStatus,
  type AuthUser,
  type VendorKycStatus,
} from "@/lib/api";

type VendorShellContext = {
  user: AuthUser | null;
  kyc: VendorKycStatus | null;
  kycVerified: boolean;
  loading: boolean;
  refreshKyc: () => Promise<VendorKycStatus>;
};

const VendorCtx = createContext<VendorShellContext | null>(null);

export function useVendorShell() {
  const ctx = useContext(VendorCtx);
  if (!ctx) throw new Error("useVendorShell must be used within VendorShell");
  return ctx;
}

type NavItem = {
  href: string;
  label: string;
  icon: string;
  requiresKyc?: boolean;
};

const NAV: NavItem[] = [
  { href: "/business", label: "Dashboard", icon: "◉" },
  { href: "/business/kyc", label: "Ruxstar Card", icon: "💳" },
  { href: "/business/businesses", label: "My businesses", icon: "🏪", requiresKyc: true },
  { href: "/business/stores", label: "Store", icon: "🏬", requiresKyc: true },
  { href: "/business/orders", label: "Bookings", icon: "📦", requiresKyc: true },
  { href: "/business/print-orders", label: "Orders", icon: "🖨️", requiresKyc: true },
  { href: "/business/payments", label: "Payments", icon: "💰", requiresKyc: true },
  { href: "/business/settings", label: "Account", icon: "⚙" },
];

function SidebarNav({
  kycVerified,
  onNavigate,
}: {
  kycVerified: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.map((item) => {
        const active =
          item.href === "/business"
            ? pathname === "/business"
            : pathname.startsWith(item.href);
        const locked = item.requiresKyc && !kycVerified;

        if (locked) {
          return (
            <Link
              key={item.href}
              href="/business/kyc"
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-500 transition hover:bg-white/5"
              title="Complete KYC to unlock"
            >
              <span className="w-5 text-center opacity-50">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              <span className="text-xs text-zinc-600">🔒</span>
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              active
                ? "bg-white/10 font-medium text-zinc-100"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            }`}
          >
            <span className="w-5 text-center">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function VendorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, ready } = useRequireAuth({ roles: ["vendor"] });
  const { data: kyc, isLoading: kycLoading, mutate: mutateKyc } = useVendorKyc(ready);
  const { data: notifications } = useNotifications(ready);
  const unreadNotifications = notifications?.unreadCount ?? 0;
  const [menuOpen, setMenuOpen] = useState(false);

  const kycVerified = kyc?.status === "verified";
  const loading = kycLoading;
  const refreshKyc = useCallback(async () => {
    const status = await getVendorKycStatus();
    await mutateKyc(status, { revalidate: false });
    return status;
  }, [mutateKyc]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <p className="text-sm text-white/50">Loading…</p>
      </div>
    );
  }

  const ctx: VendorShellContext = {
    user,
    kyc: kyc ?? null,
    kycVerified,
    loading,
    refreshKyc,
  };

  const usePageInternalScroll =
    pathname.startsWith("/business/businesses") ||
    pathname === "/business/orders" ||
    pathname.startsWith("/business/print-orders");

  return (
    <VendorCtx.Provider value={ctx}>
      <div id="vendor-shell" className="flex h-screen overflow-hidden bg-[#050505] text-[#ededef]">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/5 bg-[#0a0a0b] lg:flex">
          <div className="flex items-start justify-between border-b border-white/5 px-5 py-6">
            <div>
              <Link href="/business" className="text-lg font-semibold tracking-tight">
                Ruxstar
              </Link>
              <p className="mt-0.5 text-xs text-zinc-500">Vendor portal</p>
            </div>
            <NotificationBell pageHref="/business/notifications" unread={unreadNotifications} />
          </div>

          <SidebarNav kycVerified={kycVerified} />

          <div className="mt-auto border-t border-white/5 p-4">
            <LogoutButton />
          </div>
        </aside>

        {/* Mobile header + drawer */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/5 bg-[#0a0a0b] px-4 py-4 lg:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm"
              aria-label="Open menu"
            >
              ☰
            </button>
            <span className="text-sm font-semibold">Ruxstar Business</span>
            <div className="flex items-center gap-2">
              <NotificationBell pageHref="/business/notifications" unread={unreadNotifications} />
              <LogoutButton />
            </div>
          </header>

          {menuOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-black/70"
                onClick={() => setMenuOpen(false)}
              />
              <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-[#0a0a0b] shadow-xl">
                <div className="flex items-center justify-between border-b border-white/5 px-5 py-5">
                  <div>
                    <p className="font-semibold">Ruxstar</p>
                    <p className="text-xs text-zinc-500">Vendor portal</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-white/5"
                  >
                    ✕
                  </button>
                </div>
                <SidebarNav
                  kycVerified={kycVerified}
                  onNavigate={() => setMenuOpen(false)}
                />
              </aside>
            </div>
          )}

          <main
            className={
              usePageInternalScroll
                ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 sm:p-6 lg:p-8"
                : "min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8"
            }
          >
            {children}
          </main>
        </div>
      </div>
    </VendorCtx.Provider>
  );
}
