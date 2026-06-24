"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo, useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { getUserRole, type AuthUser } from "@/lib/api";

type AdminShellContext = {
  user: AuthUser | null;
  isAdmin: boolean;
};

const AdminCtx = createContext<AdminShellContext | null>(null);

export function useAdminShell() {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error("useAdminShell must be used within AdminShell");
  return ctx;
}

type NavItem = {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "◉" },
  { href: "/admin/kyc", label: "Vendor KYC", icon: "🪪" },
  { href: "/admin/catalog", label: "Catalog", icon: "🗂", adminOnly: true },
  { href: "/admin/staff", label: "Staff", icon: "👥" },
];

function SidebarNav({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
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

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, ready } = useRequireAuth({ staff: true });
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = getUserRole(user) === "admin";
  const ctx = useMemo<AdminShellContext>(() => ({ user, isAdmin }), [user, isAdmin]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <p className="text-sm text-white/50">Loading admin…</p>
      </div>
    );
  }

  return (
    <AdminCtx.Provider value={ctx}>
      <div className="flex h-screen overflow-hidden bg-[#050505] text-[#ededef]">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/5 bg-[#0a0a0b] lg:flex">
          <div className="border-b border-white/5 px-5 py-6">
            <Link href="/admin" className="text-lg font-semibold tracking-tight">
              Ruxstar
            </Link>
            <p className="mt-0.5 text-xs text-zinc-500">
              Admin console
              <span className="ml-1.5 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] capitalize text-zinc-400">
                {isAdmin ? "admin" : "employee"}
              </span>
            </p>
          </div>

          <SidebarNav isAdmin={isAdmin} />

          <div className="mt-auto border-t border-white/5 p-4">
            <p className="mb-3 truncate px-1 text-xs text-zinc-500">
              {user?.name || "Staff"}
            </p>
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
            <span className="text-sm font-semibold">Ruxstar Admin</span>
            <LogoutButton />
          </header>

          {menuOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/70" onClick={() => setMenuOpen(false)} />
              <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-[#0a0a0b] shadow-xl">
                <div className="flex items-center justify-between border-b border-white/5 px-5 py-5">
                  <div>
                    <p className="font-semibold">Ruxstar</p>
                    <p className="text-xs text-zinc-500">Admin console</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-white/5"
                  >
                    ✕
                  </button>
                </div>
                <SidebarNav isAdmin={isAdmin} onNavigate={() => setMenuOpen(false)} />
              </aside>
            </div>
          )}

          <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </AdminCtx.Provider>
  );
}
