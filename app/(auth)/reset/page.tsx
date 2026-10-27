import type { Metadata } from "next";
import { ResetFlow } from "./flow";

export const metadata: Metadata = { title: "Reset your password · Ruxstar" };

export default function ResetPage() {
  return <ResetFlow />;
}
