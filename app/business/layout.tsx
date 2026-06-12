import { VendorShell } from "@/components/vendor-shell";

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return <VendorShell>{children}</VendorShell>;
}
