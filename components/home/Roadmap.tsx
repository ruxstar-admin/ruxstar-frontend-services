"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Icon, type IconName } from "@/components/ui";
import styles from "./Roadmap.module.css";

type Side = "buying" | "selling";

const ROADS: Record<Side, { tab: string; icon: IconName; stops: { icon: IconName; title: string; text: string }[] }> = {
  buying: {
    tab: "I’m buying",
    icon: "bag",
    stops: [
      { icon: "search", title: "Look around", text: "Browse print shops, events, classes, turfs, stays and shops near you. No account needed." },
      { icon: "calendar", title: "Pick what you want", text: "Choose a slot, a seat, a bed or a size. The price and refund rule are shown up front." },
      { icon: "card", title: "Pay in a few taps", text: "Sign in and pay safely. No cash, no calls, no waiting." },
      { icon: "bell", title: "Get it confirmed", text: "Your ticket, booking or order is in the app straight away, with updates until it’s done." },
      { icon: "star", title: "Enjoy it", text: "Walk in, play, move in or get it at your door. Then tell others how it was." },
    ],
  },
  selling: {
    tab: "I’m selling",
    icon: "store",
    stops: [
      { icon: "store", title: "Add your business", text: "Create an account and tell us what you run and where." },
      { icon: "verified", title: "Get verified", text: "A quick identity check, so customers know you’re real." },
      { icon: "tag", title: "List what you offer", text: "Add photos, prices, timings and your refund rule." },
      { icon: "bell", title: "Take bookings", text: "Bookings and orders come to one place, where you and your team can see them." },
      { icon: "wallet", title: "Get paid", text: "Your earnings go straight to your bank account." },
    ],
  },
};

const SIDES: Side[] = ["buying", "selling"];

/** The road in a 1000 × 120 box: stops sit at the centre of each fifth, high and low in turn. */
const ROAD = "M100 30 C200 30 200 90 300 90 C400 90 400 30 500 30 C600 30 600 90 700 90 C800 90 800 30 900 30";

/** How it works, as a road from the first step to the last, for someone buying or someone selling. */
export function Roadmap() {
  const [side, setSide] = useState<Side>("buying");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const road = ROADS[side];

  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const next = SIDES[(SIDES.indexOf(side) + 1) % SIDES.length];
    setSide(next);
    tabs.current[SIDES.indexOf(next)]?.focus();
  };

  return (
    <div className={styles.roadmap}>
      <div className={styles.switch} role="tablist" aria-label="How it works for" onKeyDown={onKey}>
        {SIDES.map((s, i) => (
          <button
            key={s}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`road-tab-${s}`}
            aria-selected={side === s}
            aria-controls="road-panel"
            tabIndex={side === s ? 0 : -1}
            className={styles.tab}
            onClick={() => setSide(s)}
          >
            <Icon name={ROADS[s].icon} size={20} />
            {ROADS[s].tab}
          </button>
        ))}
      </div>

      <div id="road-panel" role="tabpanel" aria-labelledby={`road-tab-${side}`} className={styles.road} data-reveal>
        <div key={side} className={styles.trip}>
          <svg className={styles.path} viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden>
            <path d={ROAD} className={styles.base} />
            <path d={ROAD} className={styles.trail} pathLength={1} />
          </svg>
          <ol className={styles.stops}>
            {road.stops.map((stop, i) => (
              <li key={stop.title} className={styles.stop} data-low={i % 2 ? "" : undefined} style={{ "--i": i } as CSSProperties}>
                <span className={styles.spot}>
                  <span className={styles.pin}>
                    <Icon name={stop.icon} size={24} />
                  </span>
                </span>
                <h3 className={styles.title}>{stop.title}</h3>
                <p className={styles.text}>{stop.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
