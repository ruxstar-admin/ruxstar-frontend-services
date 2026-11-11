"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { ButtonLink, Icon, ToastProvider, type IconName } from "@/components/ui";
import { unreadCount } from "@/lib/api/social";
import { SessionProvider, useMe } from "./session";
import styles from "./Shell.module.css";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/feed", label: "Feed", icon: "home" },
  { href: "/search", label: "Search", icon: "search" },
  { href: "/saved", label: "Saved", icon: "bookmark" },
  { href: "/notifications", label: "Notifications", icon: "bell" },
];

/** Pages seen in the signed-in site since it loaded. One means the visitor arrived here from outside. */
let visits = 0;
let lastPath: string | null = null;

function useCountVisits() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === lastPath) return;
    lastPath = pathname;
    visits++;
  }, [pathname]);
}

/** Back within Ruxstar, or to the feed when the page was opened from a link elsewhere. */
export function useBack() {
  const router = useRouter();
  return useCallback(() => (visits > 1 ? router.back() : router.push("/feed")), [router]);
}

/** Polls gently: on every page change and when the tab comes back into view. */
function useUnread(signedIn: boolean) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    const load = () => unreadCount().then((n) => live && setCount(n), () => undefined);
    load();
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signedIn, pathname]);

  return signedIn ? count : 0;
}

function Nav() {
  const me = useMe();
  const pathname = usePathname();
  const unread = useUnread(!!me);
  const profileHref = me ? `/u/${me.username}` : "/signin";

  const tab = (t: (typeof TABS)[number]) => {
    const active = pathname === t.href;
    const badge = t.href === "/notifications" && unread > 0 ? (unread > 9 ? "9+" : String(unread)) : null;
    return (
      <Link key={t.href} href={t.href} className={styles.tab} aria-current={active ? "page" : undefined}>
        <span className={styles.icon}>
          <Icon name={t.icon} filled={active && t.icon !== "search"} size={24} />
          {badge && (
            <span className={styles.badge} aria-label={`${badge} unread`}>
              {badge}
            </span>
          )}
        </span>
        <span className={styles.tabLabel}>{t.label}</span>
      </Link>
    );
  };

  return (
    <>
      <header className={styles.bar}>
        <Link href={me ? "/feed" : "/"} className="brand">
          <img src="/logo.svg" width={30} height={30} alt="" />
          <span>ruxstar</span>
        </Link>
        {me === null ? (
          <div className={styles.guest}>
            <ButtonLink href={`/signin?next=${encodeURIComponent(pathname)}`} variant="ghost">
              Sign in
            </ButtonLink>
            <ButtonLink href="/signup">Join Ruxstar</ButtonLink>
          </div>
        ) : (
          <nav className={styles.nav} aria-label="Main" data-ready={me ? true : undefined}>
            {TABS.map(tab)}
            <Link href={profileHref} className={styles.tab} aria-current={pathname === profileHref ? "page" : undefined}>
              <span className={styles.icon}>{me ? <Avatar name={me.name} url={me.avatarUrl} size={28} /> : <Icon name="user" />}</span>
              <span className={styles.tabLabel}>Profile</span>
            </Link>
          </nav>
        )}
      </header>
    </>
  );
}

/** The signed-in website: header navigation (a bottom bar on phones), session and toasts. */
export function Shell({ children }: { children: ReactNode }) {
  useCountVisits();
  return (
    <SessionProvider>
      <ToastProvider>
        <div className={styles.page}>
          <Nav />
          <main className={styles.main}>{children}</main>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
