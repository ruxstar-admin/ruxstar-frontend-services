import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Delete your account · Ruxstar",
  description: "How to delete your Ruxstar account, what is deleted, what is kept and for how long.",
};

export default function DeleteAccountPage() {
  return (
    <article className={styles.article}>
      <h1 className={styles.title}>Delete your Ruxstar account</h1>
      <p className={styles.updated}>Last updated 15 November 2026</p>
      <p className={styles.lede}>
        This page explains how to delete your account in the Ruxstar app or on ruxstar.com, what happens to your information, and
        how to ask us to do it if you cannot use the app.
      </p>

      <h2>In the Ruxstar app</h2>
      <ol>
        <li>Open the Ruxstar app and sign in.</li>
        <li>
          Go to the <strong>Profile</strong> tab and tap the <strong>Settings</strong> (gear) icon at the top.
        </li>
        <li>
          Tap <strong>Account &amp; data</strong>, then <strong>Delete account</strong>.
        </li>
        <li>
          Enter your password and tap <strong>Delete account</strong> to confirm.
        </li>
      </ol>

      <h2>On the website</h2>
      <ol>
        <li>
          Sign in at <Link href="/account">ruxstar.com/account</Link>.
        </li>
        <li>
          Under <strong>Delete account</strong>, enter your password and confirm.
        </li>
      </ol>

      <h2>What is deleted, and when</h2>
      <ul>
        <li>
          <strong>Straight away:</strong> your profile and profile photo disappear, and every device you are signed in on is signed
          out.
        </li>
        <li>
          <strong>After 30 days:</strong> your account record, including your mobile number, name, username, email, date of birth and
          gender, is erased for good.
        </li>
      </ul>

      <h2>What is kept</h2>
      <p>
        Records we are required by law to keep, such as payment records, GST invoices and credit notes, are kept for as long as the
        law requires, and then deleted. They are used only for tax, accounting and legal reasons.
      </p>

      <h2>If you cannot use the app, or you deliver with Ruxstar Delivery</h2>
      <p>
        Email <a href="mailto:admin@ruxstar.com?subject=Delete%20my%20Ruxstar%20account">admin@ruxstar.com</a> from the email
        address on your account, or tell us the mobile number you signed up with. We will confirm it is your account and delete
        it within 30 days. Delivery partners using the Ruxstar Delivery app can ask the same way; pending earnings are paid out
        first, and payout records are kept as the law requires.
      </p>
      <p>
        More about how we handle your information is in our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </article>
  );
}
