"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Input } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe, useOnSignedOut, useSignInFirst } from "@/components/social/session";
import { CheckoutCoupons } from "@/components/coupons/CheckoutCoupons";
import { DropLocation } from "@/components/shop/DropLocation";
import { PriceLine } from "@/components/stays/pieces";
import { CartLines } from "@/components/store/CartLines";
import { clearCart, refreshItems, useCart, type Cart } from "@/components/store/cart";
import { formError, getMe } from "@/lib/api/account";
import { newIdempotencyKey } from "@/lib/api/client";
import { myOrders } from "@/lib/api/orders";
import { money } from "@/lib/api/shops";
import { getStore, myStoreOrders, placeStoreOrder, quoteCart, type DeliveryAddress, type Method, type Quote, type StoreDetail } from "@/lib/api/store";
import { deliveryAreaLine, feeLine, plural } from "@/lib/store";
import shopStyles from "@/components/shop/shop.module.css";
import styles from "@/components/shop/order.module.css";
import store from "@/components/store/store.module.css";
import events from "@/components/events/events.module.css";

const QUOTE_DELAY_MS = 350;
const digits = (text: string, max: number) => text.replace(/\D/g, "").slice(0, max);

function MethodChoice({ shop, method, onChange }: { shop: StoreDetail; method: Method; onChange: (m: Method) => void }) {
  const { setup } = shop;
  const choices: { key: Method; title: string; detail: string; icon: "truck" | "store" }[] = [
    ...(setup.delivery
      ? [{ key: "delivery" as const, title: "Delivery", detail: `${feeLine(setup.deliveryFee)} · ${deliveryAreaLine(setup, shop.city)}. The shop’s team or a Ruxstar partner brings it.`, icon: "truck" as const }]
      : []),
    ...(setup.pickup ? [{ key: "pickup" as const, title: "Pick up from the shop", detail: `Free · ${shop.address}`, icon: "store" as const }] : []),
  ];
  return (
    <fieldset className={store.methods}>
      <legend className={styles.overline}>How you get it</legend>
      {choices.map((c) => (
        <label key={c.key} className={store.method} data-on={method === c.key || undefined}>
          <input type="radio" name="method" value={c.key} checked={method === c.key} onChange={() => onChange(c.key)} />
          <Icon name={c.icon} size={20} />
          <span className={store.methodText}>
            <strong>{c.title}</strong>
            <span className={styles.small}>{c.detail}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function CheckoutForm({ cart, shop }: { cart: Cart; shop: StoreDetail }) {
  const [method, setMethod] = useState<Method>(shop.setup.delivery ? "delivery" : "pickup");
  const [address, setAddress] = useState<DeliveryAddress>({ name: "", phone: "", line: "", city: shop.city, pincode: "", point: null });
  const [note, setNote] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [priced, setPriced] = useState<{ key: string; quote: Quote | null; error: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [checked, setChecked] = useState(false);
  const attempt = useRef(newIdempotencyKey());
  const delivery = method === "delivery";

  // The last shop order's address, then the last print order's, then the account's name, phone and city.
  useEffect(() => {
    let live = true;
    Promise.all([myStoreOrders("all").catch(() => null), myOrders().catch(() => null), getMe().catch(() => null)]).then(([mine, prints, me]) => {
      if (!live) return;
      const last = mine?.items.find((o) => o.address)?.address ?? prints?.items[0]?.address ?? null;
      setAddress((now) =>
        now.name || now.phone || now.line
          ? now
          : last
            ? { name: last.name, phone: last.phone, line: last.line, city: last.city, pincode: last.pincode, point: last.point ?? null }
            : { name: me?.name ?? "", phone: (me?.phone ?? "").replace(/\D/g, "").slice(-10), line: "", city: me?.city || shop.city, pincode: "", point: null },
      );
    });
    return () => {
      live = false;
    };
  }, [shop.city]);

  const lines = cart.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }));
  // The fee and the radius depend on where it goes; the address counts once it can be found on the map.
  const findable = !!address.point || (/^[1-9]\d{5}$/.test(address.pincode) && address.line.trim().length >= 5);
  const drop = delivery && findable ? { line: address.line.trim(), city: address.city.trim(), pincode: address.pincode, point: address.point ?? null } : undefined;
  const key = JSON.stringify([lines, method, drop, code]);
  const current = priced?.key === key ? priced : null;
  const quote = current?.quote ?? null;
  const quoteError = current?.error ?? null;
  const offers = priced?.quote?.offers ?? null;

  useEffect(() => {
    attempt.current = newIdempotencyKey();
    let live = true;
    const timer = setTimeout(() => {
      quoteCart(shop.id, { lines, method, ...(drop ? { address: drop } : {}), ...(code ? { code } : {}) })
        .then((q) => {
          if (!live) return;
          setPriced({ key, quote: q, error: null });
          refreshItems(q.lines.map((l) => ({ variantId: l.variantId, price: l.unitPrice, mrp: l.mrp })));
        })
        .catch((err) => live && setPriced({ key, quote: null, error: formError(err).message }));
    }, QUOTE_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // key covers every input to the quote.
  }, [key]);

  const stock = new Map((quote ?? priced?.quote)?.lines.map((l) => [l.variantId, l.stock]) ?? []);
  const set = (field: keyof DeliveryAddress) => (text: string) =>
    setAddress((now) => ({ ...now, [field]: field === "phone" ? digits(text, 10) : field === "pincode" ? digits(text, 6) : text }));
  const fieldErrors: Partial<Record<keyof DeliveryAddress, string>> = delivery
    ? {
        ...(address.name.trim().length < 2 ? { name: "Enter the name to deliver to" } : {}),
        ...(!/^[6-9]\d{9}$/.test(address.phone) ? { phone: "Enter a 10-digit mobile number" } : {}),
        ...(address.line.trim().length < 5 ? { line: "Enter the house, street and area" } : {}),
        ...(address.city.trim().length < 2 ? { city: "Enter the city" } : {}),
        ...(!/^[1-9]\d{5}$/.test(address.pincode) ? { pincode: "Enter the 6-digit pincode" } : {}),
      }
    : {};
  const filled = Object.keys(fieldErrors).length === 0;
  const show = (message: string | undefined) => (checked ? message : undefined);
  const applied = quote?.checked && !quote.checked.problem ? { code: quote.checked.code, label: quote.offers.find((o) => o.code === quote.checked!.code)?.label ?? "" } : null;

  const place = async () => {
    if (!filled) {
      setChecked(true);
      return;
    }
    if (!quote) {
      if (quoteError) setError(quoteError);
      return;
    }
    setPlacing(true);
    setError(null);
    try {
      const { order, checkoutUrl } = await placeStoreOrder(
        shop.id,
        {
          lines,
          method,
          ...(delivery ? { address: { ...address, name: address.name.trim(), line: address.line.trim(), city: address.city.trim(), point: address.point ?? null } } : {}),
          ...(applied ? { coupon: applied.code } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          returnTo: `${window.location.origin}/orders/shop`,
        },
        attempt.current,
      );
      // The order holds what was bought now; unpaid, it can be paid from its page.
      clearCart();
      window.history.replaceState(null, "", `/orders/shop/${order.id}`);
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(formError(err).message);
      setPlacing(false);
    }
  };

  return (
    <div className={styles.page}>
      <Link href="/cart" className={events.textLink}>
        <Icon name="arrow-left" size={16} /> Cart
      </Link>
      <div>
        <h1 className={styles.title}>Checkout</h1>
        <p className={styles.small}>{shop.name}</p>
      </div>

      <section className={styles.section} aria-label="Items">
        <CartLines items={cart.items} stock={stock} />
      </section>

      <MethodChoice shop={shop} method={method} onChange={setMethod} />

      {delivery ? (
        <section className={styles.section}>
          <h2 className={styles.overline}>Deliver to</h2>
          <Input label="Name" value={address.name} onChange={(e) => set("name")(e.target.value)} maxLength={80} autoComplete="name" error={show(fieldErrors.name)} />
          <Input
            label="Phone"
            prefix="+91"
            value={address.phone}
            onChange={(e) => set("phone")(e.target.value)}
            inputMode="tel"
            maxLength={10}
            autoComplete="tel-national"
            error={show(fieldErrors.phone)}
          />
          <Input
            label="House, street and area"
            value={address.line}
            onChange={(e) => set("line")(e.target.value)}
            maxLength={300}
            autoComplete="street-address"
            error={show(fieldErrors.line)}
          />
          <DropLocation
            point={address.point ?? null}
            onLocated={(point, found) => setAddress((now) => ({ ...now, point, city: found.city && !now.city.trim() ? found.city : now.city }))}
            onClear={() => setAddress((now) => ({ ...now, point: null }))}
          />
          <div className={styles.pair}>
            <Input
              label="City"
              value={address.city}
              onChange={(e) => set("city")(e.target.value)}
              maxLength={60}
              autoComplete="address-level2"
              error={show(fieldErrors.city)}
              hint={`${shop.name} delivers in ${shop.city}`}
            />
            <Input
              label="Pincode"
              value={address.pincode}
              onChange={(e) => set("pincode")(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              autoComplete="postal-code"
              error={show(fieldErrors.pincode)}
            />
          </div>
        </section>
      ) : (
        <section className={styles.section}>
          <h2 className={styles.overline}>Pick up from</h2>
          <p className={styles.small}>{`${shop.name}, ${shop.address}`}</p>
          <p className={styles.faint}>The shop tells you when it’s ready. Show your order number when you collect it.</p>
        </section>
      )}

      <section className={styles.section}>
        <label className={styles.label} htmlFor="order-note">
          Note for the shop
        </label>
        <textarea id="order-note" className={styles.textarea} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional: gift wrap, landmark, best time…" />
      </section>

      <section className={styles.section}>
        <h2 className={styles.overline}>Offers</h2>
        <CheckoutCoupons
          offers={offers}
          applied={applied}
          discount={quote?.discount ?? 0}
          problem={quote?.checked?.problem ?? null}
          onApply={setCode}
          onRemove={() => setCode(null)}
          module="shop"
          busy={!!code && !current}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.overline}>Price</h2>
        <div className={styles.panel}>
          {quote ? (
            <dl className={styles.prices}>
              <PriceLine label={`Items (${plural(quote.lines.reduce((s, l) => s + l.quantity, 0), "item")})`} amount={quote.items} />
              {delivery && <PriceLine label={quote.deliveryKm !== null ? `Delivery (${quote.deliveryKm} km)` : "Delivery"} amount={quote.delivery} />}
              {quote.platformFee > 0 && <PriceLine label="Platform fee" amount={quote.platformFee} />}
              {quote.discount > 0 && <PriceLine label="Offer" amount={quote.discount} minus />}
              <PriceLine label="Total" amount={quote.total} strong />
            </dl>
          ) : (
            <p className={quoteError ? styles.error : styles.faint} role={quoteError ? "alert" : undefined}>
              {quoteError ?? "Working out the price…"}
            </p>
          )}
        </div>
        <p className={styles.small}>
          <Icon name="return" size={14} /> {quote?.returnRule ?? shop.returnRule}
        </p>
      </section>

      {(error || (checked && !filled)) && (
        <p className={styles.error} role="alert">
          {error ?? "Fill in the fields marked in red to pay."}
        </p>
      )}
      <div className={styles.bar}>
        <span className={styles.barText}>
          {quote ? <strong>{money(quote.total)}</strong> : !quoteError ? <span className={styles.totalLoading} role="status" aria-label="Working out the price" /> : <strong>—</strong>}
          <span className={styles.faint}>{!shop.canOrder ? (shop.whyNot ?? "Not taking orders") : delivery && !filled ? "Fill in the delivery address" : "Pay on the next page"}</span>
        </span>
        <Button size="lg" onClick={place} loading={placing} disabled={!shop.canOrder || !!quoteError}>
          Pay
        </Button>
      </div>
    </div>
  );
}

/** Checkout for the cart: delivery or pickup, the address, an offer, then payment on Cashfree. The order is made unpaid first. */
export function CheckoutScreen() {
  const me = useMe();
  const signIn = useSignInFirst();
  const onSignedOut = useOnSignedOut();
  const cart = useCart();
  const shopId = cart?.shop.id;
  const [shop, setShop] = useState<StoreDetail | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!shopId || !me) return;
    let live = true;
    getStore(shopId).then(
      (s) => live && setShop(s),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [shopId, me, onSignedOut]);

  if (cart === null)
    return (
      <Empty title="Your cart is empty">
        <p>Add something from a shop first.</p>
        <ButtonLink href="/discover?category=shop" variant="secondary">
          Find shops
        </ButtonLink>
      </Empty>
    );
  if (me === null)
    return (
      <Empty title="Sign in to check out">
        <p>Your cart stays on this device while you sign in.</p>
        <Button onClick={signIn}>Sign in</Button>
      </Empty>
    );
  if (cart && shop && shop.id === cart.shop.id) return <CheckoutForm cart={cart} shop={shop} />;
  if (error)
    return (
      <Empty title="Could not load the shop">
        <p>{formError(error).message}</p>
        <ButtonLink href="/cart" variant="secondary">
          Back to the cart
        </ButtonLink>
      </Empty>
    );
  return (
    <div className={styles.page} aria-busy>
      <div className={shopStyles.skeletonCard} />
    </div>
  );
}
