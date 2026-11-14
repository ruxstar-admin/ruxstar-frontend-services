import type { Metadata } from "next";
import { SupportList } from "@/components/support/SupportList";

export const metadata: Metadata = { title: "Account on hold · Ruxstar" };

/** Where a sign-in to an account on hold lands: help tickets only, with the pass the sign-in handed back. */
export default function HoldPage() {
  return <SupportList hold />;
}
