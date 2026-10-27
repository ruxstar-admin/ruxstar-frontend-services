import type { Metadata } from "next";
import { SignUpFlow } from "./flow";

export const metadata: Metadata = { title: "Create an account · Ruxstar" };

export default function SignUpPage() {
  return <SignUpFlow />;
}
