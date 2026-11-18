"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ButtonLink, Icon, Tag, type IconName } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { Avatar } from "@/components/profile/Avatar";
import { Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { useFreelancing } from "@/components/gigs/use-gigs";
import { myGigs, type GigsRules, type MyFreelancer, type MyGig } from "@/lib/api/gigs";
import { cardPriceLine, dayText, GIG_STATUS, percentText, plural } from "@/lib/gigs";
import vendor from "@/components/vendor/vendor.module.css";

function Row({ href, icon, title, subtitle }: { href: string; icon: IconName; title: string; subtitle: string }) {
  return (
    <li>
      <Link href={href} className={vendor.row}>
        <Icon name={icon} size={20} />
        <span className={vendor.rowText}>
          <span className={vendor.rowTitle}>{title}</span>
          <span className={vendor.rowLine}>{subtitle}</span>
        </span>
        <Icon name="chevron-right" size={18} />
      </Link>
    </li>
  );
}

function GigRow({ gig }: { gig: MyGig }) {
  const status = GIG_STATUS[gig.status];
  const line = [gig.packages.length ? cardPriceLine(gig) : "No packages yet", gig.orders ? plural(gig.orders, "order") : null].filter(Boolean).join(" · ");
  return (
    <li>
      <Link href={`/freelance/gigs/${gig.id}`} className={vendor.row}>
        <Icon name="briefcase" size={20} />
        <span className={vendor.rowText}>
          <span className={vendor.rowTitle}>{gig.title}</span>
          <span className={vendor.rowLine}>{line}</span>
        </span>
        <Tag tone={status.tone}>{status.label}</Tag>
      </Link>
    </li>
  );
}

function Home({ me, rules, fresh }: { me: MyFreelancer; rules: GigsRules; fresh: boolean }) {
  const user = useMe();
  const isVendor = !!user?.roles.vendor;
  const gigs = useLoad(() => myGigs().then((p) => p.items), "gigs");
  const room = me.gigs.total < me.gigs.max;
  const reloadGigs = gigs.reload;

  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && reloadGigs();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [reloadGigs]);

  return (
    <div className={vendor.page}>
      {fresh && (
        <p className={vendor.note}>
          <Icon name="check" size={20} />
          <span>Your profile is ready. Verify your identity, then add your first gig.</span>
        </p>
      )}

      <div className={vendor.head}>
        <div className={vendor.identity}>
          <span className={vendor.overline}>Freelancing</span>
          <h1 className={vendor.title}>{me.name}</h1>
          <span className={vendor.muted}>{me.headline}</span>
        </div>
        <Avatar name={me.name} url={me.avatarUrl} size={56} />
      </div>
      <div>
        <Tag tone={me.status === "live" ? "success" : "neutral"}>{me.status === "live" ? "Live" : "Not live yet"}</Tag>
      </div>

      {me.suspended && (
        <section className={vendor.card}>
          <p className={vendor.note} data-tone="danger">
            <Icon name="alert" size={20} />
            <span>{me.hold ? `Ruxstar put your freelancing on hold on ${dayText(me.hold.at)}.` : "Ruxstar has put your freelancing on hold."}</span>
          </p>
          {me.hold && <strong>{`Reason: ${me.hold.reason}`}</strong>}
          <span className={vendor.muted}>Your gigs and profile are hidden and you can’t take new orders. Contact Ruxstar support to sort it out.</span>
          <div className={vendor.actions}>
            <ButtonLink href="/support/new" variant="secondary">
              Contact support
            </ButtonLink>
          </div>
        </section>
      )}
      {!me.verified && (
        <section className={vendor.card}>
          <strong>Verify your identity</strong>
          <span className={vendor.muted}>You need it to publish gigs and send offers. It takes a few minutes.</span>
          <div className={vendor.actions}>
            <ButtonLink href="/verify" variant="secondary">
              Verify now
            </ButtonLink>
          </div>
        </section>
      )}

      <ul className={vendor.rows}>
        <Row href="/freelance/orders" icon="receipt" title="Orders" subtitle="Accept, deliver and follow your orders" />
        <Row href="/freelance/profile" icon="user" title="Profile and portfolio" subtitle="What customers see about you" />
        <Row href={`/gigs/freelancer/${me.businessId}`} icon="store" title="See your page" subtitle="As customers see it" />
      </ul>

      <div className={vendor.spread}>
        <h2 className={vendor.section}>{`Your gigs (${me.gigs.total} of ${me.gigs.max})`}</h2>
        {room && !me.suspended && (
          <ButtonLink href="/freelance/gigs/new" icon={<Icon name="plus" size={16} />}>
            New gig
          </ButtonLink>
        )}
      </div>
      {gigs.data ? (
        gigs.data.length ? (
          <ul className={vendor.rows}>
            {gigs.data.map((g) => (
              <GigRow key={g.id} gig={g} />
            ))}
          </ul>
        ) : (
          <Empty title="No gigs yet">
            <p>A gig is a service you sell with up to three packages, like Basic, Standard and Premium.</p>
          </Empty>
        )
      ) : gigs.error ? (
        <Failed error={gigs.error} onRetry={gigs.reload} />
      ) : (
        <Loading rows={2} />
      )}

      <h2 className={vendor.section}>Earnings</h2>
      <section className={vendor.card}>
        <span className={vendor.muted}>
          {`You get each order’s price, less your own coupons${rules.commissionBps ? ` and Ruxstar’s ${percentText(rules.commissionBps)}` : ""}. It’s held until the customer approves, or ${plural(rules.autoCompleteDays, "day")} after you deliver, then it’s yours to withdraw.`}
        </span>
      </section>
      <ul className={vendor.rows}>
        <Row href={isVendor ? "/vendor/payments" : "/freelance/payments"} icon="wallet" title="Payments and withdrawals" subtitle="Your balance, where you get paid, and withdrawing" />
        <Row href={isVendor ? "/vendor/invoices" : "/freelance/invoices"} icon="receipt" title="GST invoices" subtitle="Invoices and credit notes for your orders" />
        <Row href={isVendor ? "/vendor/coupons" : "/freelance/coupons"} icon="tag" title="Coupons" subtitle="Discounts you give on your gigs and offers" />
      </ul>
    </div>
  );
}

function Intro({ rules }: { rules: GigsRules }) {
  const open = rules.live && rules.signupsOpen;
  return (
    <Empty title={open ? "Sell your skills on Ruxstar" : "Freelancing opens soon"}>
      <p>{open ? "Make gigs people can order, send custom offers in chat, and get paid once they approve the work." : "Ruxstar isn’t taking new freelancers yet. Check back later."}</p>
      {open && <ButtonLink href="/freelance/start">Get started</ButtonLink>}
    </Empty>
  );
}

/** Your freelancing: profile, verification, your gigs, orders and how you're paid. Before you start, what it is. */
export function FreelanceHomeScreen({ fresh }: { fresh: boolean }) {
  const { data, error, reload } = useFreelancing("home");

  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [reload]);

  if (data?.me) return <Home me={data.me} rules={data.rules} fresh={fresh} />;
  if (data) return <Intro rules={data.rules} />;
  if (error) return <Failed error={error} onRetry={reload} />;
  return <Loading rows={4} />;
}
