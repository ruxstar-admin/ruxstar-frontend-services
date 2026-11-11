import type { Metadata } from "next";
import { DigilockerReturn } from "./return";

export const metadata: Metadata = { title: "Back from DigiLocker · Ruxstar", robots: { index: false } };

/** DigiLocker sends people here, from the website and from the app's browser alike. */
export default function DigilockerDonePage() {
  return <DigilockerReturn />;
}
