import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { StarMark } from "@/components/brand/StarMark";
import { HomeEffects } from "@/components/home/HomeEffects";
import { AppListing, Chip, Shot, type ShotKind } from "@/components/home/shots";
import { ButtonLink, Icon, Tag, type IconName } from "@/components/ui";
import { ABOUT } from "@/lib/content/about";
import { FAQ } from "@/lib/content/faq";
import { BOARD, FOUNDERS, initialsOf, type Person } from "@/lib/content/team";
import styles from "./page.module.css";

const SITE = "https://ruxstar.com";
const EMAIL = "admin@ruxstar.com";
const TITLE = "Ruxstar · Everything local, in one place";
const DESCRIPTION =
  "Ruxstar is a social marketplace where you discover, book and pay local businesses in Vijayawada, Gudivada and Hyderabad: print, events, coaching, sports grounds, stays and shops. Follow them, chat and post too.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Ruxstar", url: "/", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const CITIES = [
  { name: "Vijayawada", state: "Andhra Pradesh" },
  { name: "Gudivada", state: "Andhra Pradesh" },
  { name: "Hyderabad", state: "Telangana" },
];

const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Ruxstar",
  url: SITE,
  logo: `${SITE}/apple-icon.png`,
  email: EMAIL,
  description: DESCRIPTION,
  areaServed: CITIES.map((c) => ({ "@type": "City", name: c.name })),
  contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: EMAIL, url: `${SITE}/contact` },
};

const NAV = [
  { href: "#businesses", label: "Businesses" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#about", label: "About" },
  { href: "#team", label: "Team" },
];

const BUSINESSES: { kind: ShotKind; icon: IconName; name: string; line: string; href?: string }[] = [
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
  { kind: "freelance", icon: "briefcase", name: "Freelancers", line: "Hire skilled people near you, booked and paid through Ruxstar." },
];

const TRACKS: { title: string; steps: { lead: string; text: string; chip: ReactNode }[] }[] = [
  {
    title: "If you’re buying",
    steps: [
      {
        lead: "First, find it.",
        text: "Browse businesses, events, grounds, stays and shops near you. No account needed to look.",
        chip: (
          <Chip icon="search" tone="field">
            turf near Benz Circle
          </Chip>
        ),
      },
      {
        lead: "Then, pay safely.",
        text: "Sign in, choose a slot, a seat or a size, and pay through Cashfree.",
        chip: (
          <Chip icon="lock" tone="pay">
            Pay ₹800
          </Chip>
        ),
      },
      {
        lead: "Finally, get it.",
        text: "Your ticket, booking or order is in the app, with updates until it’s done.",
        chip: (
          <Chip icon="check" tone="ok">
            Booked · Court 2 · Sat 7–8 PM
          </Chip>
        ),
      },
    ],
  },
  {
    title: "If you’re selling",
    steps: [
      {
        lead: "First, list it.",
        text: "Add your business, pass a quick identity check and put up what you offer.",
        chip: (
          <Chip icon="verified" tone="ok">
            Identity check passed
          </Chip>
        ),
      },
      {
        lead: "Then, get orders.",
        text: "Bookings and orders come into one place, where your whole team can see them.",
        chip: <Chip icon="bell">New booking · Court 2 · 7 PM</Chip>,
      },
      {
        lead: "Finally, get paid.",
        text: "Payments go out to your bank account, with a statement you can download.",
        chip: <Chip icon="wallet">Payout sent to your bank</Chip>,
      },
    ],
  },
];

const TRUST: { title: string; text: string }[] = [
  {
    title: "Verified businesses",
    text: "Every business owner passes an identity check with Aadhaar, PAN and a selfie before they can take payments.",
  },
  { title: "Secure payments", text: "Payments go through Cashfree. Card and bank details are handled by Cashfree, not kept by Ruxstar." },
  {
    title: "Clear refund rules",
    text: "Every listing shows its cancellation and refund rule before you pay. Refunds go back to the way you paid.",
  },
  { title: "Honest reviews", text: "Only people who booked or bought from a business can review it." },
  { title: "Help in the app", text: "Open Help & support from your profile to talk to the Ruxstar team. We reply within 2 working days." },
];

const SOCIAL: { line: string; more: string; on: boolean; colour: string }[] = [
  { line: "Follow the places you love", more: "Their new events, offers and posts show up in your feed.", on: true, colour: "var(--logo-yellow)" },
  { line: "Like and comment on posts", more: "Say what you thought of the gig, the class or the cake, where others can see it.", on: false, colour: "var(--logo-blue)" },
  { line: "Message a business directly", more: "Ask about a size, a slot or a seat before you pay.", on: true, colour: "var(--accent-soft)" },
  { line: "Share posts of your own", more: "Photos from the match, the show or the trip, for the people who follow you.", on: false, colour: "var(--ink)" },
];

const POLICIES = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Refunds" },
  { href: "/shipping", label: "Shipping" },
  { href: "/contact", label: "Contact" },
  { href: "/delete-account", label: "Delete account" },
];

const RIDER_MAIL = `mailto:${EMAIL}?subject=${encodeURIComponent("I want to deliver with Ruxstar")}&body=${encodeURIComponent(
  "Hi Ruxstar team,\n\nI'd like to become a delivery partner.\n\nName:\nCity:\nPhone:\nVehicle:\n",
)}`;

/** Stagger step for `[data-reveal]`: each step waits 80 ms more. */
const delay = (i: number) => ({ "--d": i }) as CSSProperties;

function PersonCard({ person, large, index }: { person: Person; large?: boolean; index: number }) {
  return (
    <li className={large ? `${styles.person} ${styles.personLarge}` : styles.person} data-reveal style={delay(index)}>
      {person.photo ? (
        <img
          className={styles.avatar}
          src={person.photo}
          width={large ? 96 : 72}
          height={large ? 96 : 72}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className={styles.avatar} data-tone={index % 2 ? "blue" : "yellow"} aria-hidden>
          {initialsOf(person.name)}
        </span>
      )}
      <span className={styles.personText}>
        <h4 className={styles.personName}>{person.name}</h4>
        <span className={styles.personRole}>{person.role}</span>
      </span>
      <p className={styles.personBio}>{person.bio}</p>
      {person.linkedin && (
        <a className={styles.textLink} href={person.linkedin} target="_blank" rel="noreferrer">
          LinkedIn<span className="sr-only">: {person.name}</span>
        </a>
      )}
    </li>
  );
}

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
              <p className={styles.heroNote}>No account needed to look around. In Vijayawada, Gudivada and Hyderabad.</p>
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
                    <Shot kind={b.kind} />
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
            <div className={styles.tracks}>
              {TRACKS.map((track, t) => (
                <div key={track.title} className={t ? `${styles.track} ${styles.trackFilled}` : styles.track}>
                  <h3 className={styles.h3} data-reveal>
                    {track.title}
                  </h3>
                  <ol className={styles.steps}>
                    {track.steps.map((step, i) => (
                      <li key={step.lead} className={styles.step} data-reveal style={delay(i + 1)}>
                        <p className={styles.stepLead}>{step.lead}</p>
                        <p className={styles.stepText}>{step.text}</p>
                        <div className={styles.stepChip} aria-hidden>
                          {step.chip}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="trust-title">
          <div className={styles.wrap}>
            <ul className={styles.tiles}>
              <li className={`${styles.tile} ${styles.tileLead}`} data-reveal>
                <h2 id="trust-title" className={styles.h2}>
                  Why people trust Ruxstar
                </h2>
                <p className={styles.tileLeadText}>Paying someone new should feel safe. This is how we make sure it does.</p>
              </li>
              {TRUST.map((t, i) => (
                <li key={t.title} className={styles.tile} data-reveal style={delay(i + 1)}>
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
          <div className={styles.bands}>
            {SOCIAL.map((s) => (
              <label key={s.line} className={styles.band} style={{ "--on": s.colour } as CSSProperties}>
                <span className={styles.bandInner}>
                  <span className={styles.bandText}>
                    <span className={styles.bandLine}>{s.line}</span>
                    <span className={styles.bandMore}>{s.more}</span>
                  </span>
                  <span className={styles.switch} data-ui>
                    <input type="checkbox" role="switch" className={styles.switchInput} defaultChecked={s.on} />
                    <span className={styles.knob} aria-hidden />
                  </span>
                </span>
              </label>
            ))}
          </div>
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
          <div className={styles.letter}>
            <img className={styles.letterMark} src="/logo.svg" width={48} height={48} alt="" loading="lazy" decoding="async" />
            <h2 id="about-title" className={styles.h2} data-reveal>
              {ABOUT.heading}
            </h2>
            {ABOUT.paragraphs.map((p, i) => (
              <p key={i} className={styles.letterText} data-reveal>
                {p}
              </p>
            ))}
            <p className={styles.signOff} data-reveal>
              {ABOUT.signOff}
            </p>
          </div>
        </section>

        <section id="team" className={styles.section} aria-labelledby="team-title">
          <div className={styles.wrap}>
            <h2 id="team-title" className={styles.h2} data-reveal>
              The people behind Ruxstar
            </h2>
            <div className={styles.group}>
              <h3 className={styles.h3} data-reveal>
                Founders
              </h3>
              <ul className={styles.founders}>
                {FOUNDERS.map((p, i) => (
                  <PersonCard key={i} person={p} large index={i} />
                ))}
              </ul>
            </div>
            <div className={styles.group}>
              <h3 className={styles.h3} data-reveal>
                Board
              </h3>
              <ul className={styles.board}>
                {BOARD.map((p, i) => (
                  <PersonCard key={i} person={p} index={i + 1} />
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-label="Cities and the app">
          <div className={`${styles.wrap} ${styles.split}`}>
            <div>
              <h2 className={styles.h2} data-reveal>
                Where you’ll find us
              </h2>
              <p className={`${styles.intro} ${styles.citiesIntro}`} data-reveal style={delay(1)}>
                We’re starting in Andhra Pradesh and Telangana, close to the people we build for.
              </p>
              <ul className={styles.cities}>
                {CITIES.map((c, i) => (
                  <li key={c.name} className={styles.city} data-reveal style={delay(i + 2)}>
                    <span className={styles.cityDot} data-tone={c.state === "Telangana" ? "blue" : "yellow"} aria-hidden />
                    <span className={styles.cityName}>{c.name}</span>
                  </li>
                ))}
              </ul>
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
        <div className={styles.footTiles}>
          <div className={`${styles.footTile} ${styles.footStatement}`}>
            <p className={styles.footSay}>Everything local, in one place.</p>
            <p className={styles.footSmall}>© 2026 Ruxstar</p>
          </div>
          <nav className={`${styles.footTile} ${styles.footNav}`} aria-label="Policies">
            <ul>
              {POLICIES.map((p) => (
                <li key={p.href}>
                  <Link href={p.href}>{p.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className={`${styles.footTile} ${styles.footCities}`}>
            <p className={styles.footSmall}>Cities</p>
            <p>{CITIES.map((c) => c.name).join(", ")}</p>
          </div>
          <div className={`${styles.footTile} ${styles.footMail}`}>
            <p className={styles.footSmall}>Write to us</p>
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </div>
          <div className={`${styles.footTile} ${styles.footWord}`}>
            <img src="/logo.svg" width={72} height={72} alt="" loading="lazy" decoding="async" />
            <span>ruxstar</span>
          </div>
          <Link href="/signin" className={`${styles.footTile} ${styles.footGo}`}>
            <span>Get started</span>
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" aria-hidden>
              <path d="M10 46 46 10M18 10h28v28" />
            </svg>
          </Link>
        </div>
      </footer>

      <HomeEffects />
    </div>
  );
}
