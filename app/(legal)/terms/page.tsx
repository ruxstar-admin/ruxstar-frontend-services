import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Terms of Service · Ruxstar",
  description: "The rules for using Ruxstar on the website and in the app.",
};

export default function TermsPage() {
  return (
    <article className={styles.article}>
      <h1 className={styles.title}>Terms of Service</h1>
      <p className={styles.updated}>Last updated 1 November 2026</p>
      <p className={styles.lede}>
        These terms are the agreement between you and Ruxstar when you use ruxstar.com or the Ruxstar app. By creating an
        account you agree to them.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You need to be at least 13 years old to have an account.</li>
        <li>An account is for one person. Give your real name and keep your details up to date.</li>
        <li>
          Keep your password and the codes we text or email you to yourself. Ruxstar will never ask you to share a code.
        </li>
        <li>You are responsible for what happens on your account. If you think someone else has used it, change your password and sign out the devices you do not recognise.</li>
      </ul>

      <h2>Using Ruxstar fairly</h2>
      <p>Do not use Ruxstar to:</p>
      <ul>
        <li>pretend to be someone else, or a business you do not run;</li>
        <li>cheat, threaten, harass or abuse anyone;</li>
        <li>post anything illegal, or anything you do not have the right to share;</li>
        <li>send spam, or collect other people&apos;s details;</li>
        <li>break, overload or get around the security of the service.</li>
      </ul>

      <h2>What you post</h2>
      <p>
        You own what you post. You let Ruxstar store and show it on Ruxstar so the service can work, for as long as it stays on
        your account. We may remove anything that breaks these terms.
      </p>

      <h2>Businesses on Ruxstar</h2>
      <p>
        Print shops, event hosts, coaches and stays on Ruxstar are independent businesses. Each is responsible for what it
        offers. The price, what is included and the refund rules are shown before you pay.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time from your account settings. We may pause or close an account that breaks these
        terms, and we will tell you why unless the law stops us.
      </p>

      <h2>Our responsibility</h2>
      <p>
        We work to keep Ruxstar running and safe, but we cannot promise it will always be available or free of mistakes. As far
        as the law allows, Ruxstar is not responsible for indirect losses, such as lost profit, that come from using it.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        When we change these terms we update this page and its date. For a change that matters, we also tell you in the app or by
        email before it applies.
      </p>

      <h2>Law and contact</h2>
      <p>
        These terms are governed by the laws of India. Questions go to <a href="mailto:admin@ruxstar.com">admin@ruxstar.com</a>.
        How we handle your information is in the <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </article>
  );
}
