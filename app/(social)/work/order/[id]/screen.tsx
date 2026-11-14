"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, ButtonLink, Icon } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { ShopOrderDetails, type OrderDesk } from "@/app/(social)/vendor/orders/[id]/screen";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import {
  assignTeamDelivery,
  cancelTeamDelivery,
  getTeamOrder,
  moveTeamOrder,
  refundTeamOrder,
  teamDeliveryOptions,
  teamOrderFileLink,
  type TeamOrder,
} from "@/lib/api/orders";
import shopStyles from "@/components/shop/shop.module.css";
import vendor from "@/components/vendor/vendor.module.css";

/** One order at a shop you work at; new-order notifications link here. Same as the app. */
export function TeamOrderScreen({ id }: { id: string }) {
  const onSignedOut = useOnSignedOut();
  const [order, setOrder] = useState<TeamOrder | null>(null);
  const [error, setError] = useState<unknown>(null);
  const placeId = order?.placeId;
  const desk = useMemo<OrderDesk<TeamOrder>>(
    () => ({
      move: moveTeamOrder,
      fileLink: teamOrderFileLink,
      refund: refundTeamOrder,
      deliveryOptions: teamDeliveryOptions,
      assign: assignTeamDelivery,
      cancelDelivery: cancelTeamDelivery,
      back: placeId ? { href: `/work/${placeId}/orders`, label: "Orders" } : { href: "/work", label: "Work" },
    }),
    [placeId],
  );

  const load = useCallback(
    () =>
      getTeamOrder(id).then(
        (o) => {
          setOrder(o);
          setError(null);
        },
        (err) => !onSignedOut(err) && setError(err),
      ),
    [id, onSignedOut],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (order) return <ShopOrderDetails order={order} desk={desk} onChanged={setOrder} />;
  if (error) {
    const refused = error instanceof ApiError && (error.status === 404 || error.status === 403);
    return (
      <Empty title={refused ? (error.status === 404 ? "Order not found" : "You can’t open this order") : "Could not load this order"}>
        <p>{formError(error).message}</p>
        {refused ? (
          <ButtonLink href="/work" variant="secondary">
            Work
          </ButtonLink>
        ) : (
          <Button variant="secondary" icon={<Icon name="refresh" size={16} />} onClick={() => void load()}>
            Try again
          </Button>
        )}
      </Empty>
    );
  }
  return (
    <div className={vendor.page} aria-busy>
      <div className={shopStyles.skeletonCard} />
    </div>
  );
}
