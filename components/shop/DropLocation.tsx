"use client";

import { useState } from "react";
import { Button, Icon } from "@/components/ui";
import { cityAt } from "@/lib/api/account";
import type { GeoPoint } from "@/lib/api/orders";
import styles from "./order.module.css";

const LOCATE_TIMEOUT_MS = 10_000;

const here = () =>
  new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: LOCATE_TIMEOUT_MS, maximumAge: 0 }),
  );

interface DropLocationProps {
  point: GeoPoint | null;
  /** The point, and the city the map could name, to fill in only where empty. */
  onLocated: (point: GeoPoint, found: { city?: string }) => void;
  onClear: () => void;
}

/** "Use my location" at checkout: the exact door for delivery by distance and for the rider's map. Same as the app. */
export function DropLocation({ point, onLocated, onClear }: DropLocationProps) {
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [attribution, setAttribution] = useState<string | null>(null);

  const locate = async () => {
    setLocating(true);
    setNote(null);
    try {
      if (!("geolocation" in navigator)) throw new Error("No geolocation");
      const { coords } = await here();
      const at = { lat: coords.latitude, lng: coords.longitude };
      // Browsers have no address lookup of their own; the account's city lookup names the city.
      const found = await cityAt(at.lat, at.lng).catch(() => null);
      setAttribution(found?.city ? found.attribution : null);
      onLocated(at, found?.city ? { city: found.city } : {});
    } catch (err) {
      const denied = err instanceof GeolocationPositionError && err.code === err.PERMISSION_DENIED;
      setNote(denied ? "Location is off for this site. Allow it in your browser, or type the address in." : "Could not get your location. Type the address in instead.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className={styles.section}>
      {point ? (
        <div className={styles.locate}>
          <Icon name="map-pin" size={20} />
          <span className={styles.fileText}>
            Your location is added. Add the door number and building above.
            {attribution && <span className={styles.faint}>{`Map data ${attribution}.`}</span>}
          </span>
          <button type="button" className={styles.locateClear} aria-label="Remove your location" onClick={onClear}>
            <Icon name="close" size={20} />
          </button>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button
            variant="secondary"
            icon={locating ? <span className={styles.spinner} aria-hidden /> : <Icon name="locate" size={18} />}
            disabled={locating}
            aria-busy={locating || undefined}
            onClick={() => void locate()}
          >
            {locating ? "Finding you…" : "Use my location"}
          </Button>
        </div>
      )}
      {note && <p className={styles.locateNote}>{note}</p>}
    </div>
  );
}
