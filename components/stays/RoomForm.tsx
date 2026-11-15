"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, Input, Switch } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { addRoom, removeRoom, staysRules, updateRoom, vendorProperty, type RoomFeature, type RoomInput, type RoomKind, type RoomView, type StaysRulesView, type VendorProperty } from "@/lib/api/stays";
import { FEATURE_LABEL, FEATURES, paiseOf, priceError, ROOM_KIND_LABEL, rupees } from "@/lib/stays";
import { Stepper } from "./pieces";
import vendor from "@/components/vendor/vendor.module.css";

interface Draft {
  name: string;
  kind: RoomKind;
  beds: number;
  wholeRoom: boolean;
  month: string;
  night: string;
  features: RoomFeature[];
  live: boolean;
}

const draftOf = (room?: RoomView): Draft => ({
  name: room?.name ?? "",
  kind: room?.kind ?? "shared",
  beds: room?.beds ?? 2,
  wholeRoom: room?.wholeRoom ?? false,
  month: rupees(room?.prices.month ?? null),
  night: rupees(room?.prices.night ?? null),
  features: room?.features ?? [],
  live: room ? room.status === "live" : true,
});

function errorsOf(d: Draft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.name.trim()) e.name = "Like “101” or “Ground floor, front”";
  const month = priceError(d.month);
  const night = priceError(d.night);
  if (month) e.month = month;
  if (night) e.night = night;
  if (!d.month.trim() && !d.night.trim()) e.month = "Add a monthly or a nightly price, or both";
  return e;
}

const inputOf = (d: Draft): RoomInput => ({
  name: d.name.trim(),
  kind: d.kind,
  beds: d.beds,
  ...(d.kind === "shared" ? { wholeRoom: d.wholeRoom } : {}),
  prices: { month: d.month.trim() ? paiseOf(d.month) : null, night: d.night.trim() ? paiseOf(d.night) : null },
  features: d.features,
  status: d.live ? "live" : "paused",
});

function Form({ property, room, rules }: { property: VendorProperty; room?: RoomView; rules: StaysRulesView }) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => draftOf(room));
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef(newIdempotencyKey());
  const errors = errorsOf(draft);
  const err = (field: string) => (shown ? errors[field] : undefined);
  const back = `/vendor/properties/${property.id}`;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const per = draft.kind === "private" ? "for the room" : "per bed";

  const save = async () => {
    setShown(true);
    if (Object.keys(errors).length) return;
    setBusy("save");
    setFailure(null);
    try {
      if (room) await updateRoom(room.id, inputOf(draft));
      else await addRoom(property.id, inputOf(draft), attempt.current);
      router.push(back);
    } catch (e) {
      setFailure(formError(e).message);
      if (!keepIdempotencyKey(e)) attempt.current = newIdempotencyKey();
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!room) return;
    setBusy("delete");
    setFailure(null);
    try {
      await removeRoom(room.id);
      router.replace(back);
    } catch (e) {
      setFailure(formError(e).message);
      setDeleting(false);
      setBusy(null);
    }
  };

  return (
    <div className={vendor.page}>
      <Back href={back}>{property.name}</Back>
      <h1 className={vendor.title}>{room ? `Room ${room.name}` : "Add a room"}</h1>
      <form
        className={vendor.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Input label="Room name or number" value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={40} placeholder="Like “101”" error={err("name")} />
        <div className={vendor.field}>
          <span className={vendor.label} id="room-kind">
            Kind of room
          </span>
          <div className={vendor.chips} role="radiogroup" aria-labelledby="room-kind">
            {(["shared", "private"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={draft.kind === k} aria-pressed={draft.kind === k} className={vendor.chip} onClick={() => set("kind", k)}>
                {ROOM_KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <p className={vendor.faint}>
            {draft.kind === "shared" ? "Each bed is reserved on its own, at the bed price." : "The whole room is reserved by one tenant (or a couple), at the room price."}
          </p>
        </div>
        <div className={vendor.field}>
          <span className={vendor.label}>Beds</span>
          <Stepper label="beds" value={draft.beds} min={1} max={rules.maxBeds} onChange={(n) => set("beds", n)} />
          {room && room.bedList.length > draft.beds && <p className={vendor.faint}>Beds you take away must be free of reservations now and later.</p>}
        </div>
        {draft.kind === "shared" && draft.beds > 1 && (
          <Switch checked={draft.wholeRoom} onChange={(on) => set("wholeRoom", on)} description="At the bed price times the beds, when every bed is free.">
            Tenants can also take the whole room
          </Switch>
        )}
        <div className={vendor.pair} data-even>
          <Input
            label={`A month, ${per} (₹)`}
            inputMode="decimal"
            value={draft.month}
            onChange={(e) => set("month", e.target.value.replace(/[^\d.]/g, ""))}
            hint="Leave empty if not let by the month"
            error={err("month")}
          />
          <Input
            label={`A night, ${per} (₹)`}
            inputMode="decimal"
            value={draft.night}
            onChange={(e) => set("night", e.target.value.replace(/[^\d.]/g, ""))}
            hint="Leave empty if not let by the night"
            error={err("night")}
          />
        </div>
        <div className={vendor.field}>
          <span className={vendor.label} id="features-label">
            In the room
          </span>
          <div className={vendor.chips} role="group" aria-labelledby="features-label">
            {FEATURES.map((f) => (
              <button
                key={f}
                type="button"
                className={vendor.chip}
                aria-pressed={draft.features.includes(f)}
                onClick={() => set("features", draft.features.includes(f) ? draft.features.filter((x) => x !== f) : [...draft.features, f])}
              >
                {FEATURE_LABEL[f]}
              </button>
            ))}
          </div>
        </div>
        <Switch checked={draft.live} onChange={(on) => set("live", on)} description="Turn off to show it as full, for repairs or a tenant off Ruxstar.">
          Taking reservations
        </Switch>
        {room && property.upcoming + property.staying > 0 && <p className={vendor.faint}>Reservations already made keep the price they were made at.</p>}

        {failure && (
          <p className={vendor.error} role="alert">
            {failure}
          </p>
        )}
        <div className={vendor.actions}>
          <Button type="submit" size="lg" loading={busy === "save"}>
            {room ? "Save room" : "Add room"}
          </Button>
        </div>
      </form>

      {room &&
        (deleting ? (
          <section className={vendor.card}>
            <h2 className={vendor.section}>Remove this room?</h2>
            <p className={vendor.muted}>Only rooms without reservations to come or tenants staying can be removed.</p>
            <div className={vendor.actions}>
              <Button variant="danger" loading={busy === "delete"} onClick={() => void remove()}>
                Remove room
              </Button>
              <Button variant="ghost" disabled={busy === "delete"} onClick={() => setDeleting(false)}>
                Keep it
              </Button>
            </div>
          </section>
        ) : (
          <div className={vendor.actions}>
            <button type="button" className={vendor.link} data-muted onClick={() => setDeleting(true)}>
              Remove this room
            </button>
          </div>
        ))}
    </div>
  );
}

/** Adding a room to a property, or changing `roomId`: kind, beds, prices by the month and night, what's in it. */
export function RoomForm({ propertyId, roomId }: { propertyId: string; roomId?: string }) {
  const property = useLoad(() => vendorProperty(propertyId), propertyId);
  const rules = useLoad(staysRules, "stays");
  const failed = property.error ?? rules.error;
  if (property.data && rules.data) {
    const room = roomId ? property.data.rooms.find((r) => r.id === roomId) : undefined;
    if (roomId && !room) {
      return (
        <Empty title="Room not found">
          <p>It may have been removed.</p>
        </Empty>
      );
    }
    return <Form property={property.data} room={room} rules={rules.data} />;
  }
  if (failed)
    return (
      <Failed
        error={failed}
        onRetry={() => {
          property.reload();
          rules.reload();
        }}
      />
    );
  return <Loading rows={5} />;
}
