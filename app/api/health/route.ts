import { proxyRoute } from "@/lib/proxy";

export async function GET() {
  return proxyRoute("/health");
}
