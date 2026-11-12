import type { Metadata } from "next";
import { CreateBusinessScreen } from "./screen";

export const metadata: Metadata = { title: "Add a business · Ruxstar", robots: { index: false } };

export default function CreateBusinessPage() {
  return <CreateBusinessScreen />;
}
