"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useMe, useSetMe } from "@/components/social/session";
import { getMe } from "@/lib/api/account";
import { ButtonLink, Icon, Skeleton, type IconName } from "@/components/ui";
import styles from "@/components/admin/console.module.css";

/** `fills` for icons that still read when solid. */
const SECTIONS: { href: string; label: string; icon: IconName; fills?: true }[] = [
  { href: "/vendor", label: "Dashboard", icon: "grid", fills: true },
  { href: "/vendor/businesses", label: "Businesses", icon: "store", fills: true },
  { href: "/vendor/orders", label: "Orders", icon: "print" },
  { href: "/vendor/posts", label: "Posts", icon: "image" },
  { href: "/vendor/payments", label: "Payments", icon: "wallet" },
];

function Closed({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.muted}>{body}</p>
      <div>{action}</div>
    </div>
  );
}

/** The vendor portal: its sections beside the page, or along the top on phones. Same sections as the app's portal tabs. */
export function VendorFrame({ children }: { children: ReactNode }) {
  const me = useMe();
  const setMe = useSetMe();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const notYet = !!me && !me.roles.vendor;

  // Verification may have been approved since the session loaded; ask once before turning them away.
  useEffect(() => {
    if (!notYet || checked) return;
    let live = true;
    getMe()
      .then((user) => live && setMe(user))
      .catch(() => undefined)
      .finally(() => live && setChecked(true));
    return () => {
      live = false;
    };
  }, [notYet, checked, setMe]);

  if (me === undefined || (notYet && !checked)) {
    return (
      <div className={styles.frame} aria-busy>
        <Skeleton height={280} radius={16} />
        <Skeleton height={480} radius={16} />
      </div>
    );
  }
  if (me === null) {
    return (
      <Closed
        title="Vendor portal"
        body="Sign in to run your businesses."
        action={<ButtonLink href={`/signin?next=${encodeURIComponent(pathname)}`}>Sign in</ButtonLink>}
      />
    );
  }
  if (notYet) {
    return (
      <Closed
        title="Vendor portal"
        body="Verify your identity to open it. Then add your businesses, take orders and get paid."
        action={<ButtonLink href="/verify">Get verified</ButtonLink>}
      />
    );
  }

  const current = [...SECTIONS].sort((a, b) => b.href.length - a.href.length).find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));

  return (
    <div className={styles.frame}>
      <aside className={styles.side}>
        <div className={styles.who}>
          <span className={styles.kicker}>Vendor portal</span>
          <span className={styles.role}>{me.name}</span>
        </div>
        <nav className={styles.sections} aria-label="Vendor portal">
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} className={styles.section} aria-current={current?.href === s.href ? "page" : undefined}>
              <Icon name={s.icon} size={20} filled={current?.href === s.href && s.fills} />
              <span>{s.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
