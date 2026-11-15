import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui";
import type { PropertyCard as Card, StayPhoto } from "@/lib/api/stays";
import { coverGradient, initialOf } from "@/lib/api/shops";
import { FOR_SHORT, KIND_LABEL, foodText, priceFromText } from "@/lib/stays";
import shop from "@/components/shop/shop.module.css";
import events from "@/components/events/events.module.css";

/** The property's cover at 16:9, or its initial on its own colours when there is none. */
export function PropertyPhoto({
  photo,
  name,
  eager,
  dimmed,
  className = shop.cover,
  children,
}: {
  photo: StayPhoto | null;
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

/** A PG or hostel on Discover: the cover, its name, who it's for, food, where, and the lowest price. */
export function PropertyCard({ property, eager, index }: { property: Card; eager?: boolean; index: number }) {
  const full = property.priceFrom.month === null && property.priceFrom.night === null;
  return (
    <Link href={`/stays/${property.id}`} className={shop.card} style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
      <PropertyPhoto photo={property.photo} name={property.name} eager={eager} dimmed={full} />
      <div className={shop.cardBody}>
        <span className={events.cardTitle}>{property.name}</span>
        <span className={shop.meta}>{[KIND_LABEL[property.kind], FOR_SHORT[property.for], foodText(property.food)].join(" · ")}</span>
        <span className={events.cardFacts}>
          <span>
            <Icon name="map-pin" size={14} />
            {[property.area, property.city].filter(Boolean).join(", ")}
          </span>
          <span className={events.cardPrice}>{priceFromText(property.priceFrom)}</span>
        </span>
      </div>
    </Link>
  );
}
