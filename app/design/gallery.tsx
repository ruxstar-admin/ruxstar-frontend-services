"use client";

import { useEffect, useState } from "react";
import tokens from "@/design/tokens.json";
import { Reveal } from "@/components/motion/Reveal";
import {
  Button,
  Card,
  Icon,
  ICON_NAMES,
  Input,
  Segmented,
  Skeleton,
  Switch,
  Tag,
  ToastProvider,
  useToast,
} from "@/components/ui";
import styles from "./gallery.module.css";

type Theme = "system" | "light" | "dark";
const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const rupees = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

export function Gallery() {
  return (
    <ToastProvider>
      <Sheet />
    </ToastProvider>
  );
}

function Sheet() {
  const [theme, setTheme] = useState<Theme>("system");
  const [loading, setLoading] = useState(false);
  const [notify, setNotify] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past" | "saved">("upcoming");
  const toast = useToast();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    return () => {
      delete root.dataset.theme;
    };
  }, [theme]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className="brand">
          <img src="/logo.svg" width={30} height={30} alt="" />
          <span>ruxstar</span>
        </div>
        <div className={styles.theme}>
          <Segmented label="Theme" options={THEMES} value={theme} onChange={setTheme} />
        </div>
      </header>

      <section className={styles.intro}>
        <h1 className="t-display">Design system</h1>
        <p className={styles.lede}>
          Every screen on the website is built from these parts. Colours, type, spacing and motion come from{" "}
          <code>design/tokens.json</code>, which the mobile apps read too.
        </p>
      </section>

      <Section title="Colour" note="Monochrome. The logo is the only colour on screen.">
        <div className={styles.swatches}>
          {Object.keys(tokens.color.light).map((name) => (
            <div key={name} className={styles.swatch}>
              <span className={styles.chip} style={{ background: `var(--${name})` }} />
              <span className={styles.swatchName}>{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type" note="Fraunces 600 for 34 and up. Inter for everything else.">
        <div className={styles.stack}>
          {Object.entries(tokens.type)
            .reverse()
            .map(([name, t]) => (
              <div key={name} className={styles.typeRow}>
                <span className={styles.meta}>
                  {name} · {t.size}/{t.line}
                </span>
                <span className={`t-${name}`}>Print, events, coaching and stays</span>
              </div>
            ))}
        </div>
      </Section>

      <Section title="Buttons" note="50 px for the main action, 44 px everywhere else. Press shrinks to 97%.">
        <div className={styles.row}>
          <Button size="lg">Book now</Button>
          <Button variant="secondary" icon={<Icon name="heart" size={18} />}>
            Save
          </Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Cancel booking</Button>
          <Button loading={loading} onClick={() => setLoading((v) => !v)}>
            {loading ? "Paying" : "Pay ₹499"}
          </Button>
          <Button disabled>Sold out</Button>
        </div>
      </Section>

      <Section title="Fields">
        <div className={styles.fields}>
          <Input label="Phone number" prefix="+91" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" hint="We send a one-time code to this number." />
          <Input label="Name on the ticket" defaultValue="Ar" error="Enter at least 3 letters." />
        </div>
      </Section>

      <Section title="Controls">
        <div className={styles.controls}>
          <Segmented
            label="Bookings"
            options={[
              { value: "upcoming", label: "Upcoming" },
              { value: "past", label: "Past" },
              { value: "saved", label: "Saved" },
            ]}
            value={tab}
            onChange={setTab}
          />
          <Card>
            <Switch checked={notify} onChange={setNotify} description="Order updates and reminders.">
              Notifications
            </Switch>
          </Card>
        </div>
      </Section>

      <Section title="Tags">
        <div className={styles.row}>
          <Tag>Print</Tag>
          <Tag tone="solid">New</Tag>
          <Tag tone="success">Confirmed</Tag>
          <Tag tone="warning">Few seats left</Tag>
          <Tag tone="danger">Cancelled</Tag>
        </div>
      </Section>

      <Section title="Cards" note="Cards rise in once, 70 ms apart.">
        <div className={styles.cards}>
          {SAMPLES.map((item, i) => (
            <Reveal key={item.title} index={i}>
              <Card as="article" interactive padding="none" tabIndex={0} aria-label={item.title}>
                <div className={styles.media}>
                  <Icon name={item.icon} size={32} />
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    <Tag>{item.kind}</Tag>
                    <span className={styles.rating}>
                      <Icon name="star" size={14} filled className={styles.star} />
                      {item.rating}
                    </span>
                  </div>
                  <h3 className={styles.cardTitle}>{item.title}</h3>
                  <p className={styles.meta}>{item.where}</p>
                  <p className={styles.price}>
                    {rupees(item.pricePaise)} <span className={styles.meta}>{item.unit}</span>
                  </p>
                </div>
              </Card>
            </Reveal>
          ))}
          <Card padding="none" aria-busy="true" aria-label="Loading">
            <Skeleton height={140} radius={0} />
            <div className={styles.cardBody}>
              <Skeleton width={72} height={24} radius={999} />
              <Skeleton width="80%" height={20} />
              <Skeleton width="55%" height={14} />
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Icons" note="24 px, 1.75 stroke. Filled only for the active tab and the star.">
        <div className={styles.icons}>
          {ICON_NAMES.map((name) => (
            <div key={name} className={styles.icon}>
              <Icon name={name} />
              <span className={styles.meta}>{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Toast">
        <div className={styles.row}>
          <Button variant="secondary" onClick={() => toast("Saved to your list")}>
            Show toast
          </Button>
          <Button variant="secondary" onClick={() => toast("Booking confirmed", "success")}>
            Success
          </Button>
          <Button variant="secondary" onClick={() => toast("Payment failed. You were not charged.", "danger")}>
            Error
          </Button>
        </div>
      </Section>
    </main>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className="t-title">{title}</h2>
        {note && <p className={styles.meta}>{note}</p>}
      </div>
      {children}
    </section>
  );
}

const SAMPLES = [
  { kind: "Events", icon: "ticket", title: "Indie Night at Jubilee Hills", where: "Sat, 6 Dec · Hyderabad", rating: "4.8", pricePaise: 49900, unit: "per ticket" },
  { kind: "Stays", icon: "home", title: "Lake-view room, Gachibowli", where: "2 guests · Hyderabad", rating: "4.6", pricePaise: 289900, unit: "per night" },
  { kind: "Print", icon: "print", title: "A4 colour prints", where: "Ready in 2 hours · Madhapur", rating: "4.9", pricePaise: 800, unit: "per page" },
] as const;
