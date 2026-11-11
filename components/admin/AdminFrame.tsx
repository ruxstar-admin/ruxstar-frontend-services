"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useMe, useOnSignedOut } from "@/components/social/session";
import { Button, ButtonLink, Icon, Skeleton, type IconName } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { getAccess, type Access, type Permission } from "@/lib/api/admin";
import styles from "./console.module.css";

/** `"admin"` sections are for admins only; the rest need the permission named. */
type Need = Permission | "admin" | null;

const SECTIONS: { href: string; label: string; icon: IconName; need: Need }[] = [
  { href: "/admin", label: "Dashboard", icon: "grid", need: null },
  { href: "/admin/kyc", label: "Verification", icon: "verified", need: "kyc.view" },
  { href: "/admin/reports", label: "Reports", icon: "flag", need: "reports.view" },
  { href: "/admin/users", label: "People", icon: "user", need: "users.view" },
  { href: "/admin/staff", label: "Staff", icon: "shield", need: "admin" },
  { href: "/admin/businesses", label: "Businesses", icon: "store", need: "businesses.view" },
  { href: "/admin/modules", label: "Modules", icon: "stack", need: "modules.view" },
  { href: "/admin/audit", label: "Audit log", icon: "clock", need: "audit.view" },
];

const AccessContext = createContext<Access | null>(null);

export const allows = (access: Access, need: Need) => need === null || access.admin || (need !== "admin" && access.permissions.includes(need));

/** What the signed-in person may do in the console. Only inside `AdminFrame`. */
export function useAccess(): Access {
  const access = useContext(AccessContext);
  if (!access) throw new Error("useAccess outside AdminFrame");
  return access;
}

export const useCan = (need: Need) => allows(useAccess(), need);

function NotForYou({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.muted}>{body}</p>
      <div>
        <ButtonLink href="/feed" variant="secondary">
          Go to the feed
        </ButtonLink>
      </div>
    </div>
  );
}

/** A section's body, or a short note when this person's access does not include it. */
export function Needs({ need, children }: { need: Need; children: ReactNode }) {
  return useCan(need) ? children : <NotForYou title="Not part of your access" body="Ask a Ruxstar admin if you need this section." />;
}

/** The Ruxstar console: a section list beside the page, or along the top on phones. */
export function AdminFrame({ children }: { children: ReactNode }) {
  const me = useMe();
  const pathname = usePathname();
  const onSignedOut = useOnSignedOut();
  const [access, setAccess] = useState<Access | null>(null);
  const [failed, setFailed] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const team = !!me && (me.roles.admin || me.roles.ruxstarStaff);

  useEffect(() => {
    if (!team) return;
    let live = true;
    getAccess().then(
      (a) => live && setAccess(a),
      (err) => {
        if (!live || onSignedOut(err)) return;
        setFailed(err);
      },
    );
    return () => {
      live = false;
    };
  }, [team, attempt, onSignedOut]);

  if (me === null || (me && !team)) return <NotForYou title="Ruxstar console" body="This page is for the Ruxstar team." />;

  if (failed) {
    const forbidden = formError(failed).code === "FORBIDDEN";
    if (forbidden) return <NotForYou title="Ruxstar console" body="Your Ruxstar team access has ended. Ask an admin if this is a mistake." />;
    return (
      <div className={styles.failed} role="alert">
        <p>{formError(failed).message}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setFailed(null);
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (!access) {
    return (
      <div className={styles.frame} aria-busy>
        <Skeleton height={320} radius={16} />
        <Skeleton height={480} radius={16} />
      </div>
    );
  }

  const sections = SECTIONS.filter((s) => allows(access, s.need));
  const current = [...sections].sort((a, b) => b.href.length - a.href.length).find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));

  return (
    <AccessContext.Provider value={access}>
      <div className={styles.frame}>
        <aside className={styles.side}>
          <div className={styles.who}>
            <span className={styles.kicker}>Ruxstar console</span>
            <span className={styles.role}>{access.title ?? "Staff"}</span>
          </div>
          <nav className={styles.sections} aria-label="Console">
            {sections.map((s) => (
              <Link key={s.href} href={s.href} className={styles.section} aria-current={current?.href === s.href ? "page" : undefined}>
                <Icon name={s.icon} size={20} filled={current?.href === s.href && s.icon !== "clock"} />
                <span>{s.label}</span>
              </Link>
            ))}
          </nav>
        </aside>
        <div className={styles.body}>{children}</div>
      </div>
    </AccessContext.Provider>
  );
}
