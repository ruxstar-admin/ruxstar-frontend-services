"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useChatUnread } from "@/components/chat/use-chat-unread";
import { Avatar } from "@/components/profile/Avatar";
import { ButtonLink, Icon, ToastProvider, type IconName } from "@/components/ui";
import { homeFor } from "@/lib/api/account";
import { unreadCount } from "@/lib/api/social";
import { SessionProvider, useMe } from "./session";
import styles from "./Shell.module.css";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/feed", label: "Feed", icon: "home" },
  { href: "/discover", label: "Discover", icon: "store" },
  { href: "/search", label: "Search", icon: "search" },
  { href: "/messages", label: "Messages", icon: "chat" },
  { href: "/saved", label: "Saved", icon: "bookmark" },
  { href: "/notifications", label: "Notifications", icon: "bell" },
];

const CONSOLE_TAB = { href: "/admin", label: "Admin", icon: "shield" } as const;

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

const inPortal = (path: string) => path === "/vendor" || path.startsWith("/vendor/");

/** Where the switch goes back to in the portal, for this visit. */
let lastPortalPath = "/vendor";

/** Vendors only: on is the vendor portal, off is the rest of Ruxstar. The tabs stay the same either way. */
function PortalSwitch() {
  const router = useRouter();
  const pathname = usePathname();
  const on = inPortal(pathname);
  if (on) lastPortalPath = pathname;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={styles.portal}
      title={on ? "Leave the vendor portal" : "Open the vendor portal"}
      onClick={() => router.push(on ? "/feed" : lastPortalPath)}
    >
      <span className={styles.portalTrack} aria-hidden>
        <span className={styles.portalKnob} />
      </span>
      Vendor portal
    </button>
  );
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
  const chats = useChatUnread(!!me);
  const profileHref = me ? `/u/${me.username}` : "/signin";
  const team = !!me && (me.roles.admin || me.roles.ruxstarStaff);
  const tabs = team ? [CONSOLE_TAB, ...TABS] : TABS;

  const tab = (t: (typeof tabs)[number]) => {
    const active =
      pathname === t.href ||
      ((t.href === CONSOLE_TAB.href || t.href === "/messages") && pathname.startsWith(`${t.href}/`)) ||
      (t.href === "/discover" && pathname.startsWith("/b/"));
    const count = t.href === "/notifications" ? unread : t.href === "/messages" ? chats.unread + chats.requests : 0;
    const badge = count > 0 ? (count > 9 ? "9+" : String(count)) : null;
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
        <Link href={me ? homeFor(me) : "/"} className="brand">
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
          <div className={styles.end}>
            {me?.roles.vendor && <PortalSwitch />}
            <nav className={styles.nav} aria-label="Main" data-ready={me ? true : undefined}>
              {tabs.map(tab)}
              <Link href={profileHref} className={styles.tab} aria-current={pathname === profileHref ? "page" : undefined}>
                <span className={styles.icon}>{me ? <Avatar name={me.name} url={me.avatarUrl} size={28} /> : <Icon name="user" />}</span>
                <span className={styles.tabLabel}>Profile</span>
              </Link>
            </nav>
          </div>
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
