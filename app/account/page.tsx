import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui";
import { AccountScreen } from "./screen";

export const metadata: Metadata = { title: "Your account · Ruxstar", robots: { index: false } };

export default function AccountPage() {
  return (
    <ToastProvider>
      <AccountScreen />
    </ToastProvider>
  );
}
