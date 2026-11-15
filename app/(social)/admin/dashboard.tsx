"use client";

import { count, Freshness, SectionTile, SectionTiles, TileCells } from "@/components/admin/metrics";
import { Failed, styles } from "@/components/admin/parts";
import { useMe } from "@/components/social/session";
import { money } from "@/lib/api/shops";
import { AREA, BUSINESS_MODULES, hasQueues, liveBusinesses, moduleLine, queueTotal, sectionHref, ticketsNeedingYou } from "./dashboard/sections";
import { useConsoleMetrics } from "./dashboard/use-console-metrics";
import { MODULE_ICON, MODULE_LABEL } from "./modules/labels";
import { hasNumbers } from "./modules/numbers";

/** The console home: one tile per area, each opening a page with that area's numbers. Same as the app. */
export function Dashboard() {
  const me = useMe();
  const { access, canDesk, stats, overview, support, refresh } = useConsoleMetrics();

  const s = stats.data;
  const q = s?.queues;
  const desk = support.data;
  const blocks = s?.modules.filter(hasNumbers) ?? [];
  const businesses = blocks.filter((b) => BUSINESS_MODULES.includes(b.module));
  const delivery = blocks.find((b) => b.module === "delivery");
  const modules = overview.data?.modules;
  const queued = queueTotal(q);
  const needYou = desk ? ticketsNeedingYou(desk) : 0;
  const first = me?.name.split(" ")[0];

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{first ? `Hi ${first}` : "Dashboard"}</h1>
          <p className={styles.muted}>
            {access.admin ? "You are an admin, so every section is open to you." : `Signed in as ${access.title ?? "Ruxstar staff"}.`}
          </p>
        </div>
        {s && <Freshness asOf={s.asOf} loading={stats.loading} failed={Boolean(stats.error)} onRefresh={refresh} />}
      </div>

      {!s && stats.error ? (
        <Failed error={stats.error} onRetry={refresh} />
      ) : !s ? (
        <TileCells n={6} />
      ) : (
        <SectionTiles label="Dashboard sections">
          {hasQueues(q) && (
            <SectionTile href={sectionHref("waiting")} {...AREA.waiting} line={queued > 0 ? `${count(queued)} waiting` : "All clear"} warn={queued > 0} />
          )}
          {canDesk && (desk || Boolean(support.error)) && (
            <SectionTile
              href={sectionHref("help")}
              {...AREA.help}
              line={desk ? (needYou > 0 ? `${count(needYou)} need you` : `${count(desk.open)} open`) : undefined}
              warn={needYou > 0}
            />
          )}
          {s.people && <SectionTile href={sectionHref("people")} {...AREA.people} line={`${count(s.people.total)} accounts`} />}
          {s.money && (
            <SectionTile href={sectionHref("money")} {...AREA.money} line={`${money(s.money.collectedToday)} today`} warn={s.money.payouts.failed.count > 0} />
          )}
          {businesses.length > 0 && <SectionTile href={sectionHref("businesses")} {...AREA.businesses} line={`${count(liveBusinesses(businesses))} live`} />}
          {delivery && (
            <SectionTile href={sectionHref("delivery")} icon={MODULE_ICON.delivery} label={MODULE_LABEL.delivery} line={moduleLine(delivery, count)} tint="blue" />
          )}
          {modules && (
            <SectionTile href="/admin/modules" icon="stack" label="Modules" line={`${modules.filter((m) => m.live).length} of ${modules.length} live`} tint="amber" />
          )}
        </SectionTiles>
      )}
    </div>
  );
}
