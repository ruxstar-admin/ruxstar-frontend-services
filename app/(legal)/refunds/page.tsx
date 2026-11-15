import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Refund & cancellation policy · Ruxstar",
  description: "When you can cancel on Ruxstar, how much comes back, and how refunds are paid, for each kind of order.",
};

export default function RefundsPage() {
  return (
    <article className={styles.article}>
      <h1 className={styles.title}>Refund &amp; cancellation policy</h1>
      <p className={styles.updated}>Last updated 15 November 2026</p>
      <p className={styles.lede}>
        This page explains when you can cancel an order or booking on Ruxstar, how much comes back, and how the money reaches you.
        The exact rule for each order is shown on the booking or checkout page, above the Pay button, before you pay.
      </p>

      <h2>How refunds are paid</h2>
      <ul>
        <li>Every refund goes back to the payment method you used, through Cashfree, our payment partner.</li>
        <li>It usually shows in your account within 5 to 7 working days. Some banks take a little longer.</li>
        <li>Where we issued a GST invoice for the order, we also issue a credit note for the refund. You can download both from Invoices in the app or on the website.</li>
        <li>You can see each refund and its status on the order, and under Payments.</li>
        <li>A coupon you used is given back when the whole order is refunded.</li>
        <li>
          The Ruxstar platform fee is the small fee added to some orders on top of the business&apos;s price. Below, we say for each
          case whether it comes back.
        </li>
      </ul>

      <h2>Print orders</h2>
      <ul>
        <li>You can cancel until the print shop accepts your order. You get everything back, including the Ruxstar fee.</li>
        <li>
          If the shop turns your order down, or does not accept it within 6 hours of payment, it is cancelled and you get everything
          back automatically, including the Ruxstar fee.
        </li>
        <li>Once the shop has accepted your order, it can&apos;t be cancelled in the app. Contact the shop, or us.</li>
        <li>
          If something is wrong, such as the order did not arrive, the print is wrong or poor, or it arrived damaged, report it from
          the order page within 48 hours of delivery. If it hasn&apos;t arrived, you can report it any time after its ready date.
          Add photos if you can. The shop is not paid while we look into it.
        </li>
        <li>
          We then decide on a full refund, a part refund, or an answer. A full refund includes the Ruxstar fee. A part refund covers
          part of the shop&apos;s price, not the fee.
        </li>
      </ul>

      <h2>Event tickets</h2>
      <ul>
        <li>
          Each organiser picks one of two rules for their event: you can cancel for a full refund until a set time before the start
          (usually 24 hours), or there are no refunds. The rule is shown before you pay, and your booking shows the last time to
          cancel.
        </li>
        <li>A full refund includes the Ruxstar fee. After the last time to cancel, nothing is refunded.</li>
        <li>If the organiser or Ruxstar cancels the event, every paid ticket is refunded in full automatically, including the Ruxstar fee.</li>
      </ul>

      <h2>Coaching courses and demo classes</h2>
      <ul>
        <li>You can cancel for a full refund, including the Ruxstar fee, until the first class you paid for starts.</li>
        <li>After the first class starts, there is no refund for dropping out.</li>
        <li>
          If the institute cancels the whole batch, or the batch does not get its minimum number of students in time, everyone gets
          a full refund automatically.
        </li>
        <li>
          If a single class is cancelled or moved, everyone is told and nothing is refunded. The coach can add an extra class
          instead.
        </li>
        <li>A paid demo class is refunded in full if its class is cancelled.</li>
      </ul>

      <h2>Turf and ground bookings</h2>
      <ul>
        <li>
          You can cancel a booking, or single dates of a weekly booking, until each slot starts. How much comes back depends on how
          early you cancel: usually everything from 6 hours before the slot, half from 2 hours before, and nothing after that.
        </li>
        <li>
          Each ground can set its own hours within limits Ruxstar sets. The exact rule for the ground is shown before you pay, and the
          booking page shows what you would get back if you cancelled now.
        </li>
        <li>The Ruxstar fee comes back in the same share as the booking.</li>
        <li>
          If the ground cancels, for example for rain or a closure, or Ruxstar does, you get everything back for every date it
          cancels, including the Ruxstar fee.
        </li>
      </ul>

      <h2>PG and hostel stays</h2>
      <ul>
        <li>
          You can cancel a reservation before you move in. You get everything back, including the Ruxstar fee, until a set number of
          days before move-in, usually 3. Some properties ask for more days. The rule is shown before you pay.
        </li>
        <li>After that day, nothing is refunded, though the bed is freed.</li>
        <li>If the property or Ruxstar cancels your reservation, you get everything back, including the Ruxstar fee.</li>
        <li>
          After the owner marks you as moved in, you have a short time, usually 24 hours, to tell us something is wrong, for example
          that you didn&apos;t move in or the room isn&apos;t as listed. The owner is not paid until we decide, and we may refund you.
        </li>
        <li>
          The security deposit is paid to the owner directly, not through Ruxstar. Its return is between you and the owner. Rent after
          the first month is also between you and the owner.
        </li>
        <li>Once you have moved in, you leave by giving notice to the property, not by cancelling.</li>
      </ul>

      <h2>Local shop orders</h2>
      <ul>
        <li>You can cancel until the shop packs your order. You get everything back, including the delivery fee and the Ruxstar fee.</li>
        <li>
          If the shop does not accept your order in time (usually 6 hours), or cancels it, you get everything back automatically. The
          same applies if an item sold out while you were paying.
        </li>
        <li>Once it&apos;s packed, contact the shop or us if you need to stop it.</li>
      </ul>

      <h2>Local shop returns</h2>
      <ul>
        <li>
          Each shop chooses &ldquo;No returns&rdquo; or &ldquo;Returns within a set number of days of delivery&rdquo; (usually 2). The
          rule is shown on the shop, on each product and at checkout, before you pay.
        </li>
        <li>Where returns are allowed, ask from the order page within the window. Pick the items, the reason, and add a note if you like.</li>
        <li>
          <strong>Wrong or damaged item:</strong> the shop pays for the trip back, and you get the full price of the returned items.
        </li>
        <li>
          <strong>Changed your mind, doesn&apos;t fit, or another reason:</strong> you pay for the trip back. One delivery fee is taken
          off the refund. Pickup orders are brought back to the shop, so nothing is taken off.
        </li>
        <li>The original delivery fee and the Ruxstar fee are not refunded on a return. The refund you will get is shown before you send the request.</li>
        <li>
          The shop accepts or turns down the request, with a note you can read. Once it gets the items back, it marks them received and
          the refund starts. If you disagree with the shop, contact us and Ruxstar will decide.
        </li>
      </ul>

      <h2>Questions</h2>
      <p>
        If a refund hasn&apos;t arrived after 7 working days, or you think a rule was applied wrongly, message us from{" "}
        <strong>Help &amp; support</strong> in the app, or email <a href="mailto:admin@ruxstar.com">admin@ruxstar.com</a> with your
        order number. More ways to reach us are on <Link href="/contact">Contact us</Link>. Deliveries are covered in our{" "}
        <Link href="/shipping">Shipping &amp; delivery policy</Link>.
      </p>
    </article>
  );
}
