"use client";

import Link from "next/link";
import { Button, ButtonLink, Icon } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { PriceLine } from "@/components/stays/pieces";
import { CartLines } from "@/components/store/CartLines";
import { cartCount, clearCart, useCart } from "@/components/store/cart";
import { plural } from "@/lib/store";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";

/** The cart on this device: one shop's items, quantities and what they come to. Checkout prices them again. */
export function CartScreen() {
  const cart = useCart();

  if (cart === undefined)
    return (
      <div className={order.page} aria-busy>
        <div className={shop.skeletonCard} />
      </div>
    );
  if (!cart)
    return (
      <Empty title="Your cart is empty">
        <p>Find a shop near you and add what you need. An order is from one shop.</p>
        <ButtonLink href="/discover?category=shop" variant="secondary">
          Find shops
        </ButtonLink>
      </Empty>
    );

  const items = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const mrp = cart.items.reduce((s, i) => s + (i.mrp && i.mrp > i.price ? i.mrp : i.price) * i.quantity, 0);
  const count = cartCount(cart);

  return (
    <div className={order.page}>
      <div className={order.titleRow}>
        <h1 className={events.eventTitle}>Your cart</h1>
        <Button
          variant="ghost"
          onClick={() => {
            if (window.confirm("Remove everything from your cart?")) clearCart();
          }}
        >
          Clear cart
        </Button>
      </div>
      <p className={order.small}>
        {"From "}
        <Link href={`/shops/${cart.shop.id}`} className={events.textLink}>
          {cart.shop.name}
        </Link>
      </p>

      <section className={order.section} aria-label="Items">
        <CartLines items={cart.items} />
      </section>

      <section className={order.section} aria-label="Total">
        <dl className={order.prices}>
          {mrp > items && <PriceLine label="MRP" amount={mrp} />}
          {mrp > items && <PriceLine label="You save" amount={mrp - items} minus />}
          <PriceLine label={`Items (${plural(count, "item")})`} amount={items} strong />
        </dl>
        <p className={order.faint}>Delivery, fees and offers are added at checkout, where prices and stock are checked again.</p>
      </section>

      <div className={order.actions}>
        <ButtonLink href="/cart/checkout" size="lg" icon={<Icon name="arrow-right" size={18} />}>
          Checkout
        </ButtonLink>
        <ButtonLink href={`/shops/${cart.shop.id}`} variant="secondary">
          Keep shopping
        </ButtonLink>
      </div>
    </div>
  );
}
