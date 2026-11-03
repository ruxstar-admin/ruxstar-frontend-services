import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy · Ruxstar",
  description: "What Ruxstar collects, why, who helps us run it, and how to delete your data.",
};

export default function PrivacyPage() {
  return (
    <article className={styles.article}>
      <h1 className={styles.title}>Privacy Policy</h1>
      <p className={styles.updated}>Last updated 1 November 2026</p>
      <p className={styles.lede}>
        This is what Ruxstar collects when you use ruxstar.com or the Ruxstar app, why we need it, and what you can do about it.
        We do not sell your information.
      </p>

      <h2>What you give us</h2>
      <ul>
        <li>Your mobile number, name, username, date of birth and gender, when you sign up.</li>
        <li>Your password. We keep only a scrambled version that cannot be turned back into the password.</li>
        <li>If you add them: your profile photo, email address, bio and city.</li>
      </ul>

      <h2>What others can see</h2>
      <p>
        Your photo, name, username, bio and city are shown on your profile. Anyone can see it, including search engines.
        Your mobile number, email, date of birth and gender are never shown to other people.
      </p>
      <p>
        Before we save a photo, we remove the details hidden inside the file, such as where and on what phone it was taken.
      </p>

      <h2>What we record when you use Ruxstar</h2>
      <ul>
        <li>The devices you are signed in on, their names and when each was last active, so you can sign them out.</li>
        <li>Your IP address, and a record of account actions such as signing in or changing your password, to protect your account and stop abuse.</li>
        <li>
          Your location, only when you tap <strong>Use my location</strong>. We round it to about a kilometre, use it once to find
          your city&apos;s name, and do not keep it.
        </li>
      </ul>

      <h2>Who helps us run Ruxstar</h2>
      <p>These services handle some of your information for us, only to do the job listed:</p>
      <ul>
        <li>MSG91 sends the codes we text you.</li>
        <li>Google sends the codes we email you, and Google Cloud runs our servers and stores profile photos.</li>
        <li>MongoDB Atlas stores our database.</li>
        <li>OpenStreetMap turns a location into a city name, when you ask for it.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        The website uses two cookies to keep you signed in: one that lasts 15 minutes and one that lasts 30 days. There are no
        advertising or tracking cookies.
      </p>

      <h2>Keeping and deleting</h2>
      <p>
        You can change your details at any time on your profile. When you delete your account, your profile and photo disappear straight
        away, every device is signed out, and your account record is erased after 30 days. Records we are required by law to
        keep, such as payment records, are kept for as long as the law requires.
      </p>

      <h2>Children</h2>
      <p>Ruxstar is not for children under 13. If we learn that an account belongs to someone under 13, we delete it.</p>

      <h2>Changes and contact</h2>
      <p>
        When this policy changes we update this page and its date, and tell you in the app or by email about any change that
        matters. Questions or requests go to <a href="mailto:admin@ruxstar.com">admin@ruxstar.com</a>. The rules for using
        Ruxstar are in the <Link href="/terms">Terms of Service</Link>.
      </p>
    </article>
  );
}
