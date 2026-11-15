"use client";

import { useState } from "react";
import { Button, Icon, Input } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { useStaysDesk } from "@/components/stays/desk";
import { formError } from "@/lib/api/account";
import { getProperty, setRoomPrices, type PropertyDetail, type RoomView } from "@/lib/api/stays";
import { paiseOf, perText, priceError, ROOM_KIND_LABEL, rupees } from "@/lib/stays";
import vendor from "@/components/vendor/vendor.module.css";

function RoomPrices({ room, onSaved }: { room: RoomView; onSaved: (next: PropertyDetail) => void }) {
  const [month, setMonth] = useState(() => rupees(room.prices.month));
  const [night, setNight] = useState(() => rupees(room.prices.night));
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const none = !month.trim() && !night.trim();
  const errors = { month: none ? "Add a monthly or a nightly price, or both" : priceError(month), night: priceError(night) };
  const per = perText(room.kind);

  const save = async () => {
    setShown(true);
    setSaved(false);
    if (errors.month || errors.night) return;
    setBusy(true);
    setFailure(null);
    try {
      onSaved(await setRoomPrices(room.id, { month: month.trim() ? paiseOf(month) : null, night: night.trim() ? paiseOf(night) : null }));
      setSaved(true);
    } catch (err) {
      setFailure(formError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className={vendor.form}
      noValidate
      aria-label={`Prices for ${room.name}`}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h2 className={vendor.section}>{`${room.name} · ${ROOM_KIND_LABEL[room.kind]}${room.kind === "shared" ? `, ${room.beds} beds` : ""}`}</h2>
      <div className={vendor.pair} data-even>
        <Input
          label={`A month, ${per} (₹)`}
          inputMode="decimal"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value.replace(/[^\d.]/g, ""));
            setSaved(false);
          }}
          hint="Leave empty if not let by the month"
          error={shown ? errors.month : undefined}
        />
        <Input
          label={`A night, ${per} (₹)`}
          inputMode="decimal"
          value={night}
          onChange={(e) => {
            setNight(e.target.value.replace(/[^\d.]/g, ""));
            setSaved(false);
          }}
          hint="Leave empty if not let by the night"
          error={shown ? errors.night : undefined}
        />
      </div>
      {failure && (
        <p className={vendor.error} role="alert">
          {failure}
        </p>
      )}
      {saved && (
        <p className={vendor.note} role="status">
          <Icon name="check" size={20} />
          <span>Saved. New reservations pay these prices; ones already made keep theirs.</span>
        </p>
      )}
      <div className={vendor.actions}>
        <Button type="submit" variant="secondary" loading={busy}>
          {`Save ${room.name}`}
        </Button>
      </div>
    </form>
  );
}

/** For the owner and wardens allowed to edit the listing: each room's price by the month and by the night. */
export function DeskPricesScreen({ id }: { id: string }) {
  const { property: desk, can } = useStaysDesk(id);
  const property = useLoad(() => getProperty(id), id);

  if (property.error && !property.data) return <Failed error={property.error} onRetry={property.reload} />;
  if (!property.data) return <Loading rows={4} />;
  const rooms = property.data.rooms;

  return (
    <div className={vendor.page}>
      <Back href={`/beds/${id}`}>Bed map</Back>
      <h1 className={vendor.title}>Room prices</h1>
      {desk && !can("stays.listing") ? (
        <Empty title="You can’t change prices here">
          <p>Ask the owner to allow it in the team settings.</p>
        </Empty>
      ) : rooms.length === 0 ? (
        <Empty title="No rooms yet">
          <p>The owner adds rooms from the property’s setup.</p>
        </Empty>
      ) : (
        rooms.map((room) => <RoomPrices key={room.id} room={room} onSaved={(next) => property.setData(next)} />)
      )}
    </div>
  );
}
