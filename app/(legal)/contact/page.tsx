import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

/** OWNER TO FILL: the registered business name, address and phone. Empty lines are not shown. */
const COMPANY = { legalName: "", address: "", phone: "" };

export const metadata: Metadata = {
  title: "Contact us · Ruxstar",
  description: "How to reach the Ruxstar team by email or in the app, and how soon we reply.",
};

export default function ContactPage() {
  const registered = Boolean(COMPANY.legalName || COMPANY.address || COMPANY.phone);
  return (
    <article className={styles.article}>
      <h1 className={styles.title}>Contact us</h1>
      <p className={styles.updated}>Last updated 15 November 2026</p>
      <p className={styles.lede}>
        Questions about an order, a refund, your account or a business on Ruxstar? Here is how to reach us. We reply within 2
        working days.
      </p>

      <h2>Email</h2>
      <p>
        Write to <a href="mailto:admin@ruxstar.com">admin@ruxstar.com</a>. If it&apos;s about an order or booking, include its
        number, and send it from the email address on your account if you can.
      </p>

      <h2>In the Ruxstar app</h2>
      <ol>
        <li>Open the Ruxstar app and sign in.</li>
        <li>
          Go to the <strong>Profile</strong> tab and tap the <strong>Settings</strong> (gear) icon at the top.
        </li>
        <li>
          Tap <strong>Help &amp; support</strong> and send us a message. Our replies show up in the same place.
        </li>
      </ol>
      <p>
        On the website, sign in and go to <Link href="/support">ruxstar.com/support</Link>.
      </p>

      {registered && (
        <>
          <h2>Registered business</h2>
          <ul>
            {COMPANY.legalName && <li>{COMPANY.legalName}</li>}
            {COMPANY.address && <li>{COMPANY.address}</li>}
            {COMPANY.phone && (
              <li>
                <a href={`tel:${COMPANY.phone.replace(/\s/g, "")}`}>{COMPANY.phone}</a>
              </li>
            )}
          </ul>
        </>
      )}

      <h2>Useful pages</h2>
      <ul>
        <li>
          <Link href="/refunds">Refund &amp; cancellation policy</Link>
        </li>
        <li>
          <Link href="/shipping">Shipping &amp; delivery policy</Link>
        </li>
        <li>
          <Link href="/delete-account">Delete your account</Link>
        </li>
        <li>
          <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms of Service</Link>
        </li>
      </ul>
    </article>
  );
}
