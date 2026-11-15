"use client";

import Link from "next/link";
import { count, Freshness, SectionTile, SectionTiles } from "@/components/admin/metrics";
import { Failed, styles } from "@/components/admin/parts";
import { ButtonLink, Icon, Skeleton } from "@/components/ui";
import type { ModuleStats } from "@/lib/api/admin";
import { MODULE_ICON, MODULE_LABEL } from "../../modules/labels";
import { hasNumbers, ModuleFigures } from "../../modules/numbers";
import { HelpArea, MoneyArea, PeopleArea, WaitingArea } from "../areas";
import { AREA, BUSINESS_MODULES, hasQueues, isDashboardSection, moduleLine, sectionHref, sectionTitle, type DashboardSection } from "../sections";
import { useConsoleMetrics } from "../use-console-metrics";

function Back({ section }: { section?: DashboardSection }) {
  const business = section !== undefined && (BUSINESS_MODULES as readonly string[]).includes(section);
  return (
    <Link href={business ? sectionHref("businesses") : "/admin"} className={styles.back}>
      <Icon name="arrow-left" size={18} />
      {business ? AREA.businesses.label : "Dashboard"}
    </Link>
  );
}

function Nothing() {
  return (
    <div className={styles.empty}>
      <p className={styles.subtitle}>Nothing to show here</p>
      <p>This part isn&apos;t in your access, or it has no numbers yet.</p>
    </div>
  );
}

function NotFound() {
  return (
    <div className={styles.page}>
      <Back />
      <h1 className={styles.title}>Not found</h1>
      <p className={styles.muted}>This link doesn&apos;t point to a dashboard section.</p>
      <div>
        <ButtonLink href="/admin" variant="secondary">
          Back to the dashboard
        </ButtonLink>
      </div>
    </div>
  );
}

function Section({ section }: { section: DashboardSection }) {
  const { canDesk, stats, overview, support, refresh } = useConsoleMetrics();
  const s = stats.data;
  const blocks = s?.modules.filter(hasNumbers) ?? [];

  const body = () => {
    if (!s) return null;
    switch (section) {
      case "waiting":
        return hasQueues(s.queues) ? <WaitingArea q={s.queues} o={overview.data} /> : <Nothing />;
      case "help":
        if (!canDesk) return <Nothing />;
        if (support.data) return <HelpArea desk={support.data} />;
        return support.error ? <Failed error={support.error} onRetry={refresh} /> : <Skeleton height={260} radius={18} />;
      case "people":
        return s.people ? <PeopleArea people={s.people} staff={overview.data?.staff} /> : <Nothing />;
      case "money":
        return s.money ? <MoneyArea m={s.money} /> : <Nothing />;
      case "businesses": {
        const shown = BUSINESS_MODULES.map((m) => blocks.find((b) => b.module === m)).filter((b): b is ModuleStats => b !== undefined);
        if (!shown.length) return <Nothing />;
        return (
          <SectionTiles label="Businesses by module">
            {shown.map((b) => (
              <SectionTile
                key={b.module}
                href={sectionHref(b.module)}
                icon={MODULE_ICON[b.module]}
                label={MODULE_LABEL[b.module]}
                line={moduleLine(b, count)}
                warn={Boolean(b.businesses?.takenDown)}
                tint="purple"
              />
            ))}
          </SectionTiles>
        );
      }
      default: {
        const block = blocks.find((b) => b.module === section);
        return block ? <ModuleFigures m={block} /> : <Nothing />;
      }
    }
  };

  return (
    <div className={styles.page}>
      <Back section={section} />
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{sectionTitle(section)}</h1>
          {s && <p className={styles.muted}>Select a number to open its list.</p>}
        </div>
        {s && <Freshness asOf={s.asOf} loading={stats.loading} failed={Boolean(stats.error)} onRefresh={refresh} />}
      </div>
      {!s && stats.error ? <Failed error={stats.error} onRetry={refresh} /> : !s ? <Skeleton height={260} radius={18} /> : body()}
    </div>
  );
}

/** One dashboard area opened from its tile: its numbers, or under Businesses a tile per business. Same as the app. */
export function DashboardSectionScreen({ section }: { section: string }) {
  return isDashboardSection(section) ? <Section section={section} /> : <NotFound />;
}
