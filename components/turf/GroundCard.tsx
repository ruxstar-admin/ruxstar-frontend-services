import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui";
import type { GroundCard as Card, TurfPhoto } from "@/lib/api/turf";
import { coverGradient, initialOf } from "@/lib/api/shops";
import { priceFromText } from "@/lib/turf";
import shop from "@/components/shop/shop.module.css";
import events from "@/components/events/events.module.css";

/** The ground's cover at 16:9, or its initial on its own colours when there is none. */
export function GroundPhoto({
  photo,
  name,
  eager,
  dimmed,
  className = shop.cover,
  children,
}: {
  photo: TurfPhoto | null;
  name: string;
  eager?: boolean;
  dimmed?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={className} data-closed={dimmed || undefined} style={photo ? undefined : { background: coverGradient(name) }}>
      {photo ? (
        <img src={photo.url} width={photo.width} height={photo.height} alt={`Photo of ${name}`} loading={eager ? "eager" : "lazy"} decoding="async" />
      ) : (
        <span className={shop.initial} aria-hidden>
          {initialOf(name)}
        </span>
      )}
      {children}
    </div>
  );
}

/** A ground on Discover: the cover, then its name, sports, where, and the lowest price. Same as the app. */
export function GroundCard({ ground, eager, index }: { ground: Card; eager?: boolean; index: number }) {
  return (
    <Link href={`/grounds/${ground.id}`} className={shop.card} style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
      <GroundPhoto photo={ground.photo} name={ground.name} eager={eager} dimmed={ground.courts === 0} />
      <div className={shop.cardBody}>
        <span className={events.cardTitle}>{ground.name}</span>
        <span className={shop.meta}>
          {[ground.sports.map((s) => s.name).join(", "), `${ground.courts} ${ground.courts === 1 ? "court" : "courts"}`].filter(Boolean).join(" · ")}
        </span>
        <span className={events.cardFacts}>
          <span>
            <Icon name="map-pin" size={14} />
            {ground.city}
          </span>
          <span className={events.cardPrice}>{priceFromText(ground.priceFrom)}</span>
        </span>
      </div>
    </Link>
  );
}
