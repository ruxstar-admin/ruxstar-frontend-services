import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Shipping & delivery policy · Ruxstar",
  description: "Where Ruxstar delivers print and local shop orders, what it costs, how long it takes, and what to do if something goes wrong.",
};

export default function ShippingPage() {
  return (
    <article className={styles.article}>
      <h1 className={styles.title}>Shipping &amp; delivery policy</h1>
      <p className={styles.updated}>Last updated 15 November 2026</p>
      <p className={styles.lede}>
        Ruxstar delivers two kinds of orders: print orders and local shop orders. They are delivered within the city by a Ruxstar
        delivery partner or by the shop&apos;s own team, or you pick them up from the shop. This page explains how that works.
      </p>

      <h2>Where we deliver</h2>
      <ul>
        <li>Local shops deliver within their own city. Some deliver only up to a set distance from the shop, which they show.</li>
        <li>Print shops deliver to the cities listed on their page.</li>
        <li>If a shop doesn&apos;t deliver to your address, checkout tells you before you pay.</li>
        <li>We deliver only within India. We do not ship outside India.</li>
      </ul>

      <h2>Who delivers it</h2>
      <ul>
        <li>
          <strong>A Ruxstar delivery partner.</strong> Your order page shows the partner&apos;s name and phone number once they take
          the order.
        </li>
        <li>
          <strong>The shop&apos;s own team.</strong> Your order page says someone from the shop is bringing it.
        </li>
        <li>
          <strong>Pickup.</strong> Many local shops let you collect the order yourself. Your order page shows the shop&apos;s address
          and directions, and tells you when it&apos;s ready. There is no delivery fee for pickup.
        </li>
      </ul>

      <h2>Delivery fees</h2>
      <p>
        Each shop sets its own delivery fee, up to the most Ruxstar allows. It is often a base fee plus a charge for each km after
        the first few, and some shops deliver free. The fee for your address is shown at checkout, before you pay.
      </p>

      <h2>How long it takes</h2>
      <ul>
        <li>
          <strong>Print orders:</strong> each print shop shows how long it usually takes to get an order ready, and some do it the
          same day. Once the shop accepts your order, the order page shows the date it should be ready. It is sent out for delivery
          when it&apos;s ready.
        </li>
        <li>
          <strong>Local shop orders:</strong> the shop accepts, packs and sends out your order. The shop has to accept a paid order
          within a few hours (usually 6), or it is cancelled and refunded. Ruxstar does not set a fixed delivery time; it depends on
          the shop and how far you are.
        </li>
        <li>You can follow every step on the order page in the app or on the website, and we notify you as it moves.</li>
      </ul>

      <h2>The drop code</h2>
      <p>
        When your order is on its way, the order page shows a 4-digit drop code. Give it to the person delivering only when you have
        the order in your hands. They need it, and a photo at your door, to mark the order delivered. Do not share the code before
        that.
      </p>

      <h2>If a delivery fails</h2>
      <ul>
        <li>The person delivering may call you if they can&apos;t find the address or reach you.</li>
        <li>
          If they can&apos;t hand it over, they take the order back to the shop. The shop then arranges another delivery or contacts
          you.
        </li>
        <li>
          If a print order hasn&apos;t arrived after its ready date, report it from the order page. For a local shop order, contact the
          shop or us.
        </li>
      </ul>

      <h2>Damaged, wrong or missing items</h2>
      <p>
        Check your order when it arrives. If something is damaged, wrong or missing, tell us from the order page as soon as you can.
        Print problems can be reported within 48 hours of delivery, and local shops that take returns accept them within their return
        window. If the shop doesn&apos;t take returns, contact us. What you get back is explained in our{" "}
        <Link href="/refunds">Refund &amp; cancellation policy</Link>.
      </p>

      <h2>Things we don&apos;t ship</h2>
      <p>
        Event tickets, coaching classes, turf and ground slots, and PG and hostel stays are bookings, not goods. Nothing is shipped
        for them. Your tickets, class details and booking confirmations are in the Ruxstar app and on ruxstar.com as soon as you pay.
      </p>

      <h2>Questions</h2>
      <p>
        Message us from <strong>Help &amp; support</strong> in the app, or email{" "}
        <a href="mailto:admin@ruxstar.com">admin@ruxstar.com</a> with your order number. More ways to reach us are on{" "}
        <Link href="/contact">Contact us</Link>.
      </p>
    </article>
  );
}
