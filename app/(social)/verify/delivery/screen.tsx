"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMe, useOnSignedOut, useSetMe } from "@/components/social/session";
import { Button, ButtonLink, Icon, Input, Segmented, Skeleton, Tag, type IconName } from "@/components/ui";
import { formError, getMe } from "@/lib/api/account";
import {
  getKyc,
  isValidDrivingLicence,
  isValidPlate,
  saveDelivery,
  sendDeliveryPhoto,
  submitDelivery,
  tidyNumber,
  type CaseStatus,
  type DeliveryCase,
  type DeliveryPhotoKind,
  type Overview,
  type VehicleType,
} from "@/lib/api/kyc";
import { shrinkPhoto } from "@/lib/photo";
import styles from "../verify.module.css";

const EDITABLE: CaseStatus[] = ["not_started", "in_progress", "rejected"];
/** The API keeps these inside 1600 px. */
const PHOTO_SIDE = 1600;
const VEHICLES = [
  { value: "bike", label: "Bike" },
  { value: "scooter", label: "Scooter" },
] as const;

function Note({ icon, tone, children }: { icon: IconName; tone: "info" | "danger" | "brand"; children: ReactNode }) {
  return (
    <p className={styles.note} data-tone={tone}>
      <Icon name={icon} size={20} />
      <span>{children}</span>
    </p>
  );
}

function StatusNote({ c }: { c: DeliveryCase }) {
  if (c.status === "submitted") {
    return (
      <Note icon="clock" tone="info">
        Your details are with the Ruxstar team. We will let you know when they are checked, usually within a day.
      </Note>
    );
  }
  if (c.status === "rejected") {
    return (
      <Note icon="alert" tone="danger">
        <strong>Needs a change: </strong>
        {c.rejectionReason ?? "Check your details and send again."}
        {c.rejectionsLeft === 1 ? " One more rejection puts this on hold." : ""}
      </Note>
    );
  }
  if (c.status === "locked") {
    return (
      <Note icon="alert" tone="danger">
        Delivery verification is on hold after several rejections. Contact Ruxstar support to continue.
      </Note>
    );
  }
  return null;
}

function PhotoRow({ kind, label, added, editable, busy, onAdd }: { kind: DeliveryPhotoKind; label: string; added: boolean; editable: boolean; busy: boolean; onAdd: (kind: DeliveryPhotoKind, file: File) => void }) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const pick = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = "";
    if (file) onAdd(kind, file);
  };
  return (
    <div className={styles.photo}>
      <div className={styles.photoHead} data-added={added || undefined}>
        <Icon name={added ? "check" : "camera"} size={20} />
        <span>{label}</span>
      </div>
      {editable && (
        <div className={styles.photoActions}>
          <Button variant={added ? "secondary" : "primary"} loading={busy} onClick={() => camera.current?.click()}>
            {added ? "Take a new photo" : "Take photo"}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => gallery.current?.click()}>
            Choose from gallery
          </Button>
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.currentTarget)} />
          <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => pick(e.currentTarget)} />
        </div>
      )}
    </div>
  );
}

/**
 * Delivery partner verification: the driving licence and a bike or scooter, on top of identity. Once the Ruxstar team
 * approves it, the person delivers from the separate Ruxstar Delivery app with the same sign-in. Same as the app.
 */
export function DeliveryVerifyScreen() {
  const onSignedOut = useOnSignedOut();
  const me = useMe();
  const setMe = useSetMe();
  const [kyc, setKyc] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [licence, setLicence] = useState<string | null>(null);
  const [plate, setPlate] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getKyc()
      .then((o) => live && setKyc(o))
      .catch((err) => {
        if (live && !onSignedOut(err)) setLoadError(formError(err).message);
      });
    return () => {
      live = false;
    };
  }, [attempt, onSignedOut]);

  const c = kyc?.delivery;
  const approved = c?.status === "approved";
  const needsRole = approved && !!me && !me.roles.delivery;
  useEffect(() => {
    if (needsRole) getMe().then(setMe, () => undefined);
  }, [needsRole, setMe]);

  /** Runs one change. A failed one may still have changed the case, so reload it. */
  const run = useCallback(
    async (name: string, action: () => Promise<Overview>) => {
      setBusy(name);
      setFailure(null);
      try {
        setKyc(await action());
        return true;
      } catch (err) {
        if (onSignedOut(err)) return false;
        setFailure(formError(err).message);
        getKyc().then(setKyc, () => undefined);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [onSignedOut],
  );

  if (loadError) {
    return (
      <div className={styles.page}>
        <div className={styles.failed} role="alert">
          <p>{loadError}</p>
          <Button variant="secondary" onClick={() => (setLoadError(null), setAttempt((n) => n + 1))}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const head = (
    <header className={styles.head}>
      <h1 className={styles.title}>Delivery partner</h1>
      <p className={styles.muted}>Deliver orders for Ruxstar shops on your bike or scooter. Add your licence and vehicle once; the Ruxstar team checks them.</p>
    </header>
  );

  if (!c) {
    return (
      <div className={styles.page} aria-busy>
        {head}
        <Skeleton height={320} radius={18} />
      </div>
    );
  }

  const editable = EDITABLE.includes(c.status);
  const ready = !!c.licence.number && c.licence.photo && !!c.vehicle.type && !!c.vehicle.number && c.vehicle.photo;
  const licenceValue = licence ?? c.licence.number ?? "";
  const plateValue = plate ?? c.vehicle.number ?? "";
  const licenceError = licence !== null && licence.length > 0 && !isValidDrivingLicence(licence) ? "Type it as on the card, like TS09 20190001234." : undefined;
  const plateError = plate !== null && plate.length > 0 && !isValidPlate(plate) ? "Type the number plate, like TS09AB1234." : undefined;

  const saveLicence = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!editable || !isValidDrivingLicence(licenceValue)) return;
    if (await run("licence", () => saveDelivery({ licenceNumber: tidyNumber(licenceValue) }))) setLicence(null);
  };
  const savePlate = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!editable || !isValidPlate(plateValue)) return;
    if (await run("plate", () => saveDelivery({ vehicleNumber: tidyNumber(plateValue) }))) setPlate(null);
  };
  const pickType = (type: VehicleType) => void run("type", () => saveDelivery({ vehicleType: type }));

  const addPhoto = async (kind: DeliveryPhotoKind, file: File) => {
    setFailure(null);
    let photo: Blob;
    try {
      photo = await shrinkPhoto(file, PHOTO_SIDE);
    } catch {
      return setFailure("That file is not a photo we can read. Choose a JPEG or PNG.");
    }
    void run(kind, () => sendDeliveryPhoto(kind, photo));
  };

  const failed = failure && (
    <p className={styles.error} role="alert">
      {failure}
    </p>
  );

  if (!c.identityVerified) {
    return (
      <div className={styles.page}>
        {head}
        <section className={styles.section}>
          <Note icon="shield" tone="brand">
            Verify your identity first. It takes a few minutes with DigiLocker, your PAN and a selfie.
          </Note>
          <div className={styles.actions}>
            <ButtonLink href="/verify">Verify identity</ButtonLink>
          </div>
        </section>
      </div>
    );
  }

  if (approved) {
    return (
      <div className={styles.page}>
        {head}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>
              <Icon name="bicycle" size={22} /> You can deliver with Ruxstar
            </h2>
            <Tag tone="success">Approved</Tag>
          </div>
          <p className={styles.muted}>
            {c.vehicle.type === "scooter" ? "Scooter" : "Bike"} {c.vehicle.number}
          </p>
          <Note icon="phone" tone="brand">
            Open the Ruxstar Delivery app and sign in with this same account. Go online there to get deliveries, and shops you work for can send you theirs.
          </Note>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {head}
      <StatusNote c={c} />

      <section className={styles.section} aria-labelledby="licence">
        <div className={styles.sectionHead}>
          <h2 id="licence" className={styles.sectionTitle}>
            <Icon name="card" size={22} /> Driving licence
          </h2>
          {c.licence.number && c.licence.photo && <Tag tone="success">Added</Tag>}
        </div>
        <form className={styles.inline} onSubmit={(e) => void saveLicence(e)} noValidate>
          <Input
            label="Licence number"
            value={licenceValue}
            onChange={(e) => setLicence(e.target.value.toUpperCase().slice(0, 24))}
            placeholder="TS09 20190001234"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            disabled={!editable}
            error={licenceError}
          />
          {editable && licence !== null && licence !== c.licence.number && (
            <Button type="submit" loading={busy === "licence"} disabled={!isValidDrivingLicence(licenceValue)}>
              Save licence number
            </Button>
          )}
        </form>
        <PhotoRow kind="licence" label="Photo of the front of your licence" added={c.licence.photo} editable={editable} busy={busy === "licence"} onAdd={(k, f) => void addPhoto(k, f)} />
      </section>

      <section className={styles.section} aria-labelledby="vehicle">
        <div className={styles.sectionHead}>
          <h2 id="vehicle" className={styles.sectionTitle}>
            <Icon name="bicycle" size={22} /> Your vehicle
          </h2>
          {c.vehicle.type && c.vehicle.number && c.vehicle.photo && <Tag tone="success">Added</Tag>}
        </div>
        <Segmented label="Vehicle" options={VEHICLES} value={c.vehicle.type} onChange={(type) => editable && busy !== "type" && pickType(type)} />
        <form className={styles.inline} onSubmit={(e) => void savePlate(e)} noValidate>
          <Input
            label="Number plate"
            value={plateValue}
            onChange={(e) => setPlate(e.target.value.toUpperCase().slice(0, 16))}
            placeholder="TS09AB1234"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            disabled={!editable}
            error={plateError}
          />
          {editable && plate !== null && plate !== c.vehicle.number && (
            <Button type="submit" loading={busy === "plate"} disabled={!isValidPlate(plateValue)}>
              Save number plate
            </Button>
          )}
        </form>
        <PhotoRow kind="vehicle" label="Photo of the vehicle with its number plate" added={c.vehicle.photo} editable={editable} busy={busy === "vehicle"} onAdd={(k, f) => void addPhoto(k, f)} />
      </section>

      {failed}

      {editable && (
        <div className={styles.submit}>
          <p className={styles.muted}>{ready ? "All set. Send it to the Ruxstar team to check." : "Add the licence and vehicle with both photos to send for review."}</p>
          <Button size="lg" disabled={!ready} loading={busy === "submit"} onClick={() => void run("submit", submitDelivery)}>
            Send for review
          </Button>
        </div>
      )}
    </div>
  );
}
