import { Icon, type IconName } from "@/components/ui";
import styles from "./shots.module.css";

/**
 * Small, true-size pieces of the Ruxstar app for the home page. Sample content only: no real business, person or order.
 * They hold no links or buttons, so keyboard and screen-reader users skip them; the text around them says the same.
 */

export type ShotKind = "pod" | "events" | "coaching" | "turf" | "stays" | "shop" | "freelance";

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? `${styles.line} ${styles.total}` : styles.line}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function PrintOrder() {
  return (
    <>
      <div className={styles.top}>
        <span className={styles.title}>Print order</span>
        <span className={`${styles.pill} ${styles.ok}`}>
          <Icon name="truck" size={14} />
          Out for delivery
        </span>
      </div>
      <div className={styles.file}>
        <Icon name="print" size={22} />
        <span className={styles.fileText}>
          <span className={styles.strong}>Project-report.pdf</span>
          <span className={styles.meta}>42 pages · A4 · Black and white · Spiral bound</span>
        </span>
      </div>
      <div className={styles.lines}>
        <Line label="42 pages × ₹2" value="₹84" />
        <Line label="Spiral binding" value="₹30" />
        <Line label="Delivery" value="₹20" />
        <Line label="Total" value="₹134" strong />
      </div>
    </>
  );
}

/** A made-up QR code: real finder squares, random modules. It encodes nothing. */
function Qr() {
  const size = 25;
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const finder = (x: number, y: number) =>
    `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5zM${x + 2} ${y + 2}h3v3h-3z`;
  const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x > size - 9 && y < 8) || (x < 8 && y > size - 9);
  let modules = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inFinder(x, y) && random() > 0.52) modules += `M${x} ${y}h1v1h-1z`;
    }
  }
  return (
    <svg className={styles.qr} viewBox={`-2 -2 ${size + 4} ${size + 4}`} width="148" height="148" aria-hidden>
      <rect x="-2" y="-2" width={size + 4} height={size + 4} fill="#fff" />
      <path fill="#0D0C12" fillRule="evenodd" d={`${finder(0, 0)}${finder(size - 7, 0)}${finder(0, size - 7)}${modules}`} />
    </svg>
  );
}

function Ticket() {
  return (
    <>
      <div className={styles.top}>
        <span className={styles.title}>Open mic night</span>
        <span className={styles.pill}>Admit 2</span>
      </div>
      <span className={styles.meta}>Sat, 6 Dec · 7:00 PM · Gate opens 6:30 PM</span>
      <div className={styles.tear} />
      <div className={styles.qrWrap}>
        <Qr />
        <span className={styles.meta}>Show this at the gate</span>
      </div>
    </>
  );
}

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const CLASS_DAYS = new Set([0, 2, 4]);

function Course() {
  return (
    <>
      <div className={styles.top}>
        <span className={styles.title}>Spoken English</span>
        <span className={styles.pill}>Online or in person</span>
      </div>
      <span className={styles.meta}>Batch B · 6:00–7:00 PM</span>
      <div className={styles.week}>
        {DAYS.map((d, i) => (
          <span key={i} className={CLASS_DAYS.has(i) ? `${styles.day} ${styles.dayOn}` : styles.day}>
            {d}
          </span>
        ))}
      </div>
      <Line label="Fee" value="₹2,500 a month" strong />
      <span className={styles.button}>Book a demo class</span>
    </>
  );
}

const SLOTS: { time: string; state?: "taken" | "picked" }[] = [
  { time: "5 PM", state: "taken" },
  { time: "6 PM" },
  { time: "7 PM", state: "picked" },
  { time: "8 PM" },
  { time: "9 PM", state: "taken" },
  { time: "10 PM" },
];

function Slots() {
  return (
    <>
      <div className={styles.top}>
        <span className={styles.title}>Court 2 · 5-a-side</span>
        <span className={styles.meta}>Sat, 6 Dec</span>
      </div>
      <div className={styles.slots}>
        {SLOTS.map((s) => (
          <span key={s.time} className={[styles.slot, s.state && styles[s.state]].filter(Boolean).join(" ")}>
            {s.time}
          </span>
        ))}
      </div>
      <Line label="7:00–8:00 PM" value="₹800" strong />
      <span className={styles.button}>Book 7–8 PM</span>
    </>
  );
}

function Room() {
  return (
    <>
      <div className={styles.top}>
        <span className={styles.title}>Twin sharing room</span>
        <span className={`${styles.pill} ${styles.ok}`}>1 bed free</span>
      </div>
      <span className={styles.meta}>PG for women · Food included · Wi-Fi</span>
      <div className={styles.beds}>
        <span className={styles.bed}>
          <Icon name="bed" size={20} />
          Bed A<span className={styles.meta}>Taken</span>
        </span>
        <span className={`${styles.bed} ${styles.bedPicked}`}>
          <Icon name="bed" size={20} />
          Bed B<span className={styles.meta}>Free</span>
        </span>
      </div>
      <Line label="Rent" value="₹6,500 a month" strong />
      <span className={styles.button}>Reserve bed B</span>
    </>
  );
}

function Item({ name, qty, price }: { name: string; qty: number; price: string }) {
  return (
    <div className={styles.item}>
      <span className={styles.itemName}>{name}</span>
      <span className={styles.stepper}>
        <Icon name="minus" size={14} />
        {qty}
        <Icon name="plus" size={14} />
      </span>
      <span className={styles.strong}>{price}</span>
    </div>
  );
}

function Cart() {
  return (
    <>
      <div className={styles.top}>
        <span className={styles.title}>Your cart</span>
        <span className={styles.meta}>Grocery · delivers today</span>
      </div>
      <div className={styles.lines}>
        <Item name="Basmati rice, 5 kg" qty={1} price="₹520" />
        <Item name="Toor dal, 1 kg" qty={2} price="₹320" />
        <Line label="Delivery" value="₹30" />
        <Line label="Total" value="₹870" strong />
      </div>
      <span className={styles.button}>Pay ₹870</span>
    </>
  );
}

function Soon() {
  return (
    <>
      <span className={styles.title}>Freelancers</span>
      <span className={styles.meta}>Hire skilled people near you, booked and paid through Ruxstar.</span>
      <span className={styles.pill}>Coming soon</span>
    </>
  );
}

const SHOTS: Record<ShotKind, () => React.JSX.Element> = {
  pod: PrintOrder,
  events: Ticket,
  coaching: Course,
  turf: Slots,
  stays: Room,
  shop: Cart,
  freelance: Soon,
};

/** One business's screen, as the customer sees it in the app. */
export function Shot({ kind, className }: { kind: ShotKind; className?: string }) {
  const Body = SHOTS[kind];
  return (
    <div className={[styles.ui, className].filter(Boolean).join(" ")} data-ui>
      <Body />
    </div>
  );
}

/** A one-line piece of the app: a search box, a pay button, a status. */
export function Chip({ icon, children, tone }: { icon: IconName; children: React.ReactNode; tone?: "ok" | "field" | "pay" }) {
  return (
    <div className={[styles.chip, tone && styles[`chip-${tone}`]].filter(Boolean).join(" ")} data-ui>
      <Icon name={icon} size={18} />
      <span>{children}</span>
    </div>
  );
}

/** The app's store listing, until it is on Google Play. */
export function AppListing() {
  return (
    <div className={`${styles.ui} ${styles.listing}`} data-ui>
      <div className={styles.listingTop}>
        <img src="/logo.svg" width={64} height={64} alt="" loading="lazy" decoding="async" className={styles.appIcon} />
        <span className={styles.fileText}>
          <span className={styles.title}>Ruxstar</span>
          <span className={styles.meta}>Social marketplace for local businesses</span>
        </span>
      </div>
      <span className={`${styles.button} ${styles.buttonOff}`}>Coming soon to Google Play</span>
    </div>
  );
}
