import type { Metadata } from "next";
import { SignInForm } from "./form";

export const metadata: Metadata = { title: "Sign in · Ruxstar" };

export default function SignInPage() {
  return <SignInForm />;
}
