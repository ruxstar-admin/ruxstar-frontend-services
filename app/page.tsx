import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { StarMark } from "@/components/brand/StarMark";
import { HomeEffects } from "@/components/home/HomeEffects";
import { Roadmap } from "@/components/home/Roadmap";
import { Scene, type SceneKind } from "@/components/home/scenes";
import { AppListing } from "@/components/home/shots";
import { ButtonLink, Icon, Tag, type IconName } from "@/components/ui";
import { ABOUT } from "@/lib/content/about";
import { FAQ } from "@/lib/content/faq";
import styles from "./page.module.css";

const SITE = "https://ruxstar.com";
const EMAIL = "admin@ruxstar.com";
const TITLE = "Ruxstar · Everything local, in one place";
const DESCRIPTION =
  "Ruxstar is a social marketplace where you discover, book and pay local businesses in Hyderabad: print, events, coaching, sports grounds, stays and shops. Follow them, chat and post too.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Ruxstar", url: "/", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const CITY = "Hyderabad";

const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Ruxstar",
  url: SITE,
  logo: `${SITE}/apple-icon.png`,
  email: EMAIL,
  description: DESCRIPTION,
  areaServed: [{ "@type": "City", name: CITY }],
  contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: EMAIL, url: `${SITE}/contact` },
};

const NAV = [
  { href: "#businesses", label: "Businesses" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#about", label: "About" },
];

const BUSINESSES: { kind: SceneKind; icon: IconName; name: string; line: string; href?: string }[] = [
  {
    kind: "pod",
    icon: "print",
    name: "Print on demand",
    line: "Send a document, pick the paper and binding, and get the prints delivered.",
    href: "/discover?category=pod",
  },
  { kind: "events", icon: "ticket", name: "Events", line: "Buy tickets in a few taps and walk in with a QR code.", href: "/discover?category=events" },
  {
    kind: "coaching",
    icon: "book",
    name: "Coaching",
    line: "Join classes and courses, in person or online. Some start with a demo class.",
    href: "/discover?category=coaching",
  },
  { kind: "turf", icon: "ball", name: "Sports & turf", line: "Book courts and grounds by the hour, in the slot that suits you.", href: "/discover?category=turf" },
  { kind: "stays", icon: "bed", name: "Stays", line: "Find a PG or hostel, see which beds are free and reserve one.", href: "/discover?category=stays" },
  { kind: "shop", icon: "bag", name: "Local shops", line: "Order from shops near you and get it delivered to your door.", href: "/discover?category=shop" },
  {
    kind: "freelance",
    icon: "briefcase",
    name: "Freelancers",
    line: "Hire skilled people near you, booked and paid through Ruxstar.",
    href: "/discover?category=gigs",
  },
];

const TRUST: { icon: IconName; title: string; text: string }[] = [
  { icon: "verified", title: "Verified businesses", text: "Every owner passes an identity check before they can take a single payment." },
  { icon: "lock", title: "Safe payments", text: "Pay online in a few taps. Your card and bank details are never kept by Ruxstar or the business." },
  { icon: "return", title: "Clear refunds", text: "The cancellation rule is on every listing before you pay, and refunds go back the way you paid." },
  { icon: "star", title: "Real reviews", text: "Only people who actually booked or bought from a business can review it." },
];

/** `field` fills the band with a colour; the others sit on the page with their icon in `tint`. */
const SOCIAL: { icon: IconName; line: string; more: string; field?: string; tint?: string }[] = [
  { icon: "heart", line: "Follow the places you love", more: "Their new events, offers and posts show up in your feed.", field: "var(--logo-yellow)" },
  { icon: "comment", line: "Like and comment on posts", more: "Say what you thought of the gig, the class or the cake, where others can see it.", tint: "var(--logo-blue)" },
  { icon: "chat", line: "Message a business directly", more: "Ask about a size, a slot or a seat before you pay.", field: "var(--accent-soft)" },
  { icon: "camera", line: "Share posts of your own", more: "Photos from the match, the show or the trip, for the people who follow you.", tint: "var(--logo-yellow)" },
];

const RIDER_MAIL = `mailto:${EMAIL}?subject=${encodeURIComponent("I want to deliver with Ruxstar")}&body=${encodeURIComponent(
  "Hi Ruxstar team,\n\nI'd like to become a delivery partner.\n\nName:\nCity:\nPhone:\nVehicle:\n",
)}`;

const FOOT_LINKS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Explore",
    links: [
      { href: "/discover", label: "Browse" },
      { href: "#businesses", label: "Businesses" },
      { href: "#how-it-works", label: "How it works" },
      { href: "#about", label: "About" },
    ],
  },
  {
    title: "Work with us",
    links: [
      { href: "/signin", label: "List your business" },
      { href: RIDER_MAIL, label: "Deliver with Ruxstar" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "#faq", label: "Questions" },
      { href: "/delete-account", label: "Delete account" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/refunds", label: "Refunds" },
      { href: "/shipping", label: "Shipping" },
    ],
  },
];

/** Stagger step for `[data-reveal]`: each step waits 80 ms more. */
const delay = (i: number) => ({ "--d": i }) as CSSProperties;

/** The public home page. Signed-in people go straight to their feed. */
export default async function Home() {
  if ((await cookies()).has("rx_at")) redirect("/feed");

  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION).replace(/</g, "\\u003c") }} />
      <a className={styles.skip} href="#main">
        Skip to content
      </a>

      <header className={styles.bar}>
        <div className={styles.barInner}>
          <Link href="/" className={`brand ${styles.brand}`} aria-label="Ruxstar home">
            <img src="/logo.svg" width={30} height={30} alt="" />
            <span className={styles.wordmark}>ruxstar</span>
          </Link>
          <nav className={styles.nav} aria-label="On this page">
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className={styles.barActions}>
            <ButtonLink href="/signin" variant="ghost" className={styles.barButton}>
              Sign in
            </ButtonLink>
            <ButtonLink href="/signin" className={styles.barButton}>
              Get started
            </ButtonLink>
          </div>
        </div>
      </header>

      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <h1 id="hero-title" className={styles.display}>
                <span className={styles.line}>
                  <span>Everything local,</span>
                </span>
                <span className={styles.line}>
                  <span>in one place</span>
                </span>
              </h1>
              <p className={styles.lede}>
                Ruxstar is a social marketplace where you discover, book and pay local businesses, then follow them, chat with
                them and share what you find.
              </p>
              <div className={styles.heroActions}>
                <ButtonLink href="/discover" size="lg">
                  Explore Ruxstar
                </ButtonLink>
                <ButtonLink href="/signin" size="lg" variant="secondary">
                  List your business
                </ButtonLink>
              </div>
              <p className={styles.heroNote}>No account needed to look around. Now in Hyderabad.</p>
            </div>
            <div className={styles.heroMark}>
              <StarMark className={styles.mark} />
            </div>
          </div>
        </section>

        <section id="businesses" className={styles.section} aria-labelledby="businesses-title">
          <div className={styles.wrap}>
            <div className={styles.head}>
              <h2 id="businesses-title" className={styles.h2} data-reveal>
                What you can do on Ruxstar
              </h2>
              <p className={styles.intro} data-reveal style={delay(1)}>
                Every business here takes bookings and payments the same way, so once you have used one, you know them all.
              </p>
            </div>
            <div className={styles.biz} data-picker>
              <ul className={styles.bizList}>
                {BUSINESSES.map((b, i) => {
                  const body = (
                    <>
                      <Icon name={b.icon} size={26} className={styles.bizIcon} />
                      <span className={styles.bizText}>
                        <h3 className={styles.bizName}>{b.name}</h3>
                        <span className={styles.bizLine}>{b.line}</span>
                      </span>
                      {b.href ? <Icon name="arrow-right" size={22} className={styles.bizArrow} /> : <Tag>Coming soon</Tag>}
                    </>
                  );
                  return (
                    <li key={b.kind} data-reveal style={delay(i)}>
                      {b.href ? (
                        <Link href={b.href} className={styles.bizRow} data-pick={b.kind} data-on={i === 0 ? "" : undefined}>
                          {body}
                        </Link>
                      ) : (
                        <div className={`${styles.bizRow} ${styles.bizSoon}`} data-pick={b.kind}>
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className={styles.stage} aria-hidden>
                {BUSINESSES.map((b, i) => (
                  <div key={b.kind} className={styles.shot} data-shot={b.kind} data-on={i === 0 ? "" : undefined}>
                    <Scene kind={b.kind} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className={styles.section} aria-labelledby="how-title">
          <div className={styles.wrap}>
            <h2 id="how-title" className={styles.h2} data-reveal>
              How it works
            </h2>
            <p className={`${styles.intro} ${styles.howIntro}`} data-reveal style={delay(1)}>
              From the first tap to the last, here is the way.
            </p>
            <Roadmap />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="trust-title">
          <div className={styles.wrap}>
            <ul className={styles.tiles}>
              <li className={`${styles.tile} ${styles.tileLead}`} data-reveal>
                <h2 id="trust-title" className={styles.h2}>
                  Why people trust Ruxstar
                </h2>
                <p className={styles.tileLeadText}>Paying someone new should feel safe. Here’s how we make sure it does.</p>
              </li>
              {TRUST.map((t, i) => (
                <li key={t.title} className={styles.tile} data-reveal style={delay(i + 1)}>
                  <Icon name={t.icon} size={28} className={styles.tileIcon} />
                  <h3 className={styles.tileTitle}>{t.title}</h3>
                  <p>{t.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="social-title">
          <div className={styles.wrap}>
            <div className={`${styles.head} ${styles.headSplit}`}>
              <h2 id="social-title" className={styles.h2} data-reveal>
                More than a store
              </h2>
              <p className={styles.intro} data-reveal style={delay(1)}>
                Ruxstar has a feed, like the social apps you already use, and the businesses you buy from are in it.
              </p>
            </div>
          </div>
          <ul className={styles.bands}>
            {SOCIAL.map((s) => (
              <li
                key={s.line}
                className={styles.band}
                data-field={s.field ? "" : undefined}
                style={{ "--field": s.field, "--tint": s.tint } as CSSProperties}
              >
                <div className={styles.bandInner}>
                  <div className={styles.bandText} data-reveal>
                    <h3 className={styles.bandLine}>{s.line}</h3>
                    <p className={styles.bandMore}>{s.more}</p>
                  </div>
                  <Icon name={s.icon} size={48} className={styles.bandIcon} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-label="Businesses and delivery partners">
          <div className={`${styles.wrap} ${styles.work}`}>
            <div className={`${styles.panel} ${styles.panelGrow}`} data-reveal>
              <h2 className={styles.h2}>Grow with Ruxstar</h2>
              <p className={styles.panelBig}>0% commission at launch.</p>
              <p className={styles.panelText}>One app to run your business: bookings and orders, your team, and payouts.</p>
              <ul className={styles.checks}>
                <li>
                  <Icon name="check" size={20} />
                  Take bookings and orders online
                </li>
                <li>
                  <Icon name="check" size={20} />
                  Add your team and decide who does what
                </li>
                <li>
                  <Icon name="check" size={20} />
                  See every payment and payout
                </li>
                <li>
                  <Icon name="check" size={20} />
                  Reply to messages and reviews
                </li>
              </ul>
              <ButtonLink href="/signin" size="lg" className={styles.panelButton}>
                List your business
              </ButtonLink>
            </div>
            <div className={`${styles.panel} ${styles.panelRide}`} data-reveal style={delay(1)}>
              <Icon name="bicycle" size={32} />
              <h2 className={styles.h2}>Deliver with Ruxstar</h2>
              <p className={styles.panelText}>Deliver orders from shops in your city, on your own time.</p>
              <ul className={styles.checks}>
                <li>
                  <Icon name="check" size={20} />
                  Accept the trips you want
                </li>
                <li>
                  <Icon name="check" size={20} />
                  Follow the route in the Ruxstar Delivery app
                </li>
                <li>
                  <Icon name="check" size={20} />
                  See what each trip pays, with payouts to your bank
                </li>
              </ul>
              <ButtonLink href={RIDER_MAIL} size="lg" variant="secondary" className={styles.panelButton}>
                Become a delivery partner
              </ButtonLink>
            </div>
          </div>
        </section>

        <section id="about" className={styles.section} aria-labelledby="about-title">
          <div className={`${styles.wrap} ${styles.about}`}>
            <div className={styles.aboutHead}>
              <h2 id="about-title" className={styles.h2} data-reveal>
                {ABOUT.heading}
              </h2>
              <p className={styles.aboutLead} data-reveal style={delay(1)}>
                {ABOUT.lead}
              </p>
              <ButtonLink href="/contact" size="lg" variant="secondary" className={styles.aboutButton}>
                Say hello
              </ButtonLink>
            </div>
            <ol className={styles.aboutPoints}>
              {ABOUT.points.map((p, i) => (
                <li key={p.title} className={styles.aboutPoint} data-reveal style={delay(i + 1)}>
                  <h3 className={styles.tileTitle}>{p.title}</h3>
                  <p className={styles.aboutText}>{p.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.section} aria-label="Cities and the app">
          <div className={`${styles.wrap} ${styles.split}`}>
            <div>
              <h2 className={styles.h2} data-reveal>
                Where you’ll find us
              </h2>
              <p className={`${styles.intro} ${styles.citiesIntro}`} data-reveal style={delay(1)}>
                We’re starting in Hyderabad, close to the people we build for. More cities soon.
              </p>
              <p className={styles.city} data-reveal style={delay(2)}>
                <span className={styles.cityDot} aria-hidden />
                {CITY}
              </p>
            </div>
            <div className={styles.app}>
              <h2 className={styles.h2} data-reveal>
                Get the app
              </h2>
              <p className={styles.intro} data-reveal style={delay(1)}>
                The Ruxstar app is coming soon to Google Play. Until then, everything works right here in your browser, on
                any phone.
              </p>
              <div data-reveal style={delay(2)}>
                <AppListing />
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className={styles.section} aria-labelledby="faq-title">
          <div className={`${styles.wrap} ${styles.faq}`}>
            <div className={styles.faqHead}>
              <h2 id="faq-title" className={styles.h2} data-reveal>
                Questions, answered
              </h2>
              <p className={styles.intro} data-reveal style={delay(1)}>
                Something else on your mind? Write to <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
              </p>
            </div>
            <div className={styles.faqList}>
              {FAQ.map((f, i) => (
                <details key={f.question} className={styles.faqItem} data-reveal style={delay(Math.min(i, 4))}>
                  <summary className={styles.faqQuestion}>
                    <span>{f.question}</span>
                    <Icon name="chevron-down" size={22} className={styles.faqChevron} />
                  </summary>
                  <div className={styles.faqAnswer}>
                    <p>{f.answer}</p>
                    {f.link && (
                      <Link href={f.link.href} className={styles.textLink}>
                        {f.link.label}
                      </Link>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footInner}>
          <div className={styles.footCta}>
            <p className={styles.footCtaTitle}>Find something local today.</p>
            <div className={styles.footCtaActions}>
              <ButtonLink href="/discover" size="lg">
                Explore Ruxstar
              </ButtonLink>
              <ButtonLink href="/signin" size="lg" variant="secondary">
                List your business
              </ButtonLink>
            </div>
          </div>

          <div className={styles.footGrid}>
            <div className={styles.footBrand}>
              <span className={styles.footLogo}>
                <img src="/logo.svg" width={40} height={40} alt="" loading="lazy" decoding="async" />
                ruxstar
              </span>
              <p className={styles.footSay}>Everything local, in one place.</p>
              <a className={styles.footMail} href={`mailto:${EMAIL}`}>
                {EMAIL}
              </a>
            </div>
            {FOOT_LINKS.map((group) => (
              <nav key={group.title} className={styles.footCol} aria-label={group.title}>
                <p className={styles.footHead}>{group.title}</p>
                <ul>
                  {group.links.map((l) => (
                    <li key={l.label}>
                      {l.href.startsWith("/") ? <Link href={l.href}>{l.label}</Link> : <a href={l.href}>{l.label}</a>}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className={styles.footBottom}>
            <span>© 2026 Ruxstar</span>
            <span>Made in Hyderabad</span>
          </div>
        </div>
      </footer>

      <HomeEffects />
    </div>
  );
}
