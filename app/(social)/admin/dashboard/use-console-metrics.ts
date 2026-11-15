"use client";

import { useState } from "react";
import { allows, useAccess } from "@/components/admin/AdminFrame";
import { useLoad } from "@/components/admin/metrics";
import { getOverview, getStats } from "@/lib/api/admin";
import { supportSummary } from "@/lib/api/support";

const loadStats = () => getStats();

/** The dashboard's three sources: the stats route, the overview (delivery partners waiting, what was reported, staff, modules live) and the help desk summary. */
export function useConsoleMetrics() {
  const access = useAccess();
  const [attempt, setAttempt] = useState(0);
  const canDesk = allows(access, "support.view");
  const stats = useLoad(loadStats, true, attempt);
  const overview = useLoad(getOverview, true, attempt);
  const support = useLoad(supportSummary, canDesk, attempt);
  const refresh = () => setAttempt((n) => n + 1);
  return { access, canDesk, stats, overview, support, refresh };
}
