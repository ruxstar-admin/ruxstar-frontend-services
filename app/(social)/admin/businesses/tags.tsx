import { Tag, type TagTone } from "@/components/ui";
import type { Business } from "@/lib/api/admin";

/** Where a business stands, as its vendor sees it in the app. */
export function businessState(b: Business): [string, TagTone] {
  if (b.suspension) return ["On hold", "danger"];
  if (b.status === "draft") return ["Draft", "neutral"];
  if (!b.moduleLive) return ["Paused", "warning"];
  return b.open ? ["Open", "success"] : ["Closed", "neutral"];
}

export function BusinessTag({ business }: { business: Business }) {
  const [label, tone] = businessState(business);
  return <Tag tone={tone}>{label}</Tag>;
}
