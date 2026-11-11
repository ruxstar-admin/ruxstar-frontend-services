import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminFrame } from "@/components/admin/AdminFrame";

export const metadata: Metadata = { title: "Ruxstar console", robots: { index: false } };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminFrame>{children}</AdminFrame>;
}
