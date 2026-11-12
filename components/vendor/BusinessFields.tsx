"use client";

import { useMemo, useState } from "react";
import { Button, Icon, Input } from "@/components/ui";
import { useOnSignedOut } from "@/components/social/session";
import { cityAt } from "@/lib/api/account";
import { DESCRIPTION_MAX, digitsOnly, type BusinessCatalog, type ProfileErrors, type ProfileField, type ProfileValues } from "@/lib/api/vendor";
import { Select, TextArea } from "./parts";
import styles from "./vendor.module.css";

const OTHER_CITY = "Other";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function geolocate(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 });
  });
}

interface BusinessFieldsProps {
  values: ProfileValues;
  errors: ProfileErrors;
  onChange: (patch: Partial<ProfileValues>) => void;
  states: BusinessCatalog["states"];
  namePlaceholder?: string;
  detailHint?: string;
}

/** Name, phone, the location (current location, state, city, address lines) and the description. Same fields as the app. */
export function BusinessFields({ values, errors, onChange, states, namePlaceholder, detailHint }: BusinessFieldsProps) {
  const onSignedOut = useOnSignedOut();
  const cities = useMemo(() => states.find((s) => s.name === values.state)?.cities ?? [], [states, values.state]);
  const [otherCity, setOtherCity] = useState(() => !!values.city && !cities.some((c) => same(c, values.city)));
  const [locating, setLocating] = useState(false);
  const [locateNote, setLocateNote] = useState<string | null>(null);

  const text = (field: ProfileField, clean: (t: string) => string = (t) => t) => (t: string) => onChange({ [field]: clean(t) });

  const locate = async () => {
    setLocating(true);
    setLocateNote(null);
    try {
      const { coords } = await geolocate();
      const point = { lat: coords.latitude, lng: coords.longitude };
      const found = await cityAt(point.lat, point.lng);
      const state = found.city ? states.find((s) => s.cities.some((c) => same(c, found.city!))) : undefined;
      if (!found.city || !state) {
        onChange({ point, ...(found.city ? { city: found.city } : {}) });
        if (found.city) setOtherCity(!cities.some((c) => same(c, found.city!)));
        setLocateNote(`We saved the map point${found.city ? ` near ${found.city}` : ""}. Choose the state and check the city below.`);
        return;
      }
      const city = state.cities.find((c) => same(c, found.city!))!;
      setOtherCity(false);
      onChange({ point, state: state.name, city });
      setLocateNote(`Filled from your location (${found.attribution}). Add the door number, building and street.`);
    } catch (err) {
      if (onSignedOut(err)) return;
      const denied = err instanceof GeolocationPositionError && err.code === err.PERMISSION_DENIED;
      setLocateNote(denied ? "Location is off for this site. Allow it in your browser, or fill the address in." : "Could not get your location. Fill the address in instead.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <>
      <Input
        label="Business name"
        value={values.name}
        onChange={(e) => text("name")(e.target.value)}
        error={errors.name}
        placeholder={namePlaceholder}
        autoComplete="organization"
        maxLength={80}
      />
      <Input
        label="Business phone"
        value={values.phone}
        onChange={(e) => text("phone", (t) => digitsOnly(t, 10))(e.target.value)}
        error={errors.phone}
        hint="Customers call this number."
        prefix="+91"
        inputMode="tel"
        autoComplete="tel-national"
        maxLength={10}
      />

      <h2 className={styles.overline}>Location</h2>
      <div className={styles.actions}>
        <Button variant="secondary" loading={locating} icon={<Icon name="map-pin" size={18} />} onClick={() => void locate()}>
          {values.point ? "Update from current location" : "Use current location"}
        </Button>
      </div>
      {locateNote && <p className={styles.muted}>{locateNote}</p>}

      <div className={styles.pair} data-even>
        <Select
          label="State"
          value={values.state}
          options={states.map((s) => s.name)}
          placeholder="Choose the state"
          error={errors.state}
          onChange={(state) => {
            if (state === values.state) return;
            setOtherCity(false);
            onChange({ state, city: "" });
          }}
        />
        <Select
          label="City"
          value={otherCity ? OTHER_CITY : (cities.find((c) => same(c, values.city)) ?? "")}
          options={[...cities, OTHER_CITY]}
          placeholder={values.state ? "Choose the city" : "Choose the state first"}
          disabled={!values.state}
          error={otherCity ? undefined : errors.city}
          onChange={(city) => {
            const other = city === OTHER_CITY;
            setOtherCity(other);
            onChange({ city: other ? "" : city });
          }}
        />
      </div>
      {otherCity && (
        <Input
          label="City name"
          value={values.city}
          onChange={(e) => text("city")(e.target.value)}
          error={errors.city}
          autoComplete="address-level2"
          maxLength={60}
        />
      )}
      <div className={styles.pair}>
        <Input label="Door no." value={values.doorNo} onChange={(e) => text("doorNo")(e.target.value)} error={errors.doorNo} maxLength={60} />
        <Input label="Building" value={values.building} onChange={(e) => text("building")(e.target.value)} error={errors.building} maxLength={120} />
      </div>
      <Input label="Street" value={values.street} onChange={(e) => text("street")(e.target.value)} error={errors.street} maxLength={120} />
      <div className={styles.pair} data-even>
        <Input label="Area" value={values.area} onChange={(e) => text("area")(e.target.value)} error={errors.area} maxLength={120} />
        <Input
          label="PIN code"
          value={values.pincode}
          onChange={(e) => text("pincode", (t) => digitsOnly(t, 6))(e.target.value)}
          error={errors.pincode}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
        />
      </div>

      <TextArea
        label="About (optional)"
        value={values.description}
        onChange={text("description")}
        error={errors.description}
        placeholder={detailHint ?? "What you offer, in a few lines"}
        max={DESCRIPTION_MAX}
      />
    </>
  );
}
