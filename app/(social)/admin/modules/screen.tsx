"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Rows, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { Icon, Tag } from "@/components/ui";
import { listModules, type ModuleSettings } from "@/lib/api/admin";
import { MODULE_ICON, MODULE_LABEL, moduleSummary } from "./labels";

/** Every module in a short list, each opening its own page with its settings, rules and GST. Same as the app. */
export function ModulesScreen() {
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [modules, setModules] = useState<ModuleSettings[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    listModules().then(
      (list) => live && setModules(list),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [attempt, onSignedOut]);

  return (
    <Needs need="modules.view">
      <div className={styles.page}>
        <div className={styles.head}>
          <div>
            <h1 className={styles.title}>Modules</h1>
            <p className={styles.muted}>
              {canManage ? "Open a module to change it. Changes apply at once and are written to the audit log." : "You can see these settings. Ask an admin to change them."}
            </p>
          </div>
          <Link href="/admin/gst" className={styles.muted}>
            GST settings
          </Link>
        </div>
        {error ? (
          <Failed
            error={error}
            onRetry={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          />
        ) : !modules ? (
          <Rows count={7} />
        ) : (
          <ul className={styles.list}>
            {modules.map((m) => (
              <li key={m.module} className={styles.item}>
                <Link href={`/admin/modules/${m.module}`} className={styles.row}>
                  <span className={styles.moduleIcon}>
                    <Icon name={MODULE_ICON[m.module]} size={22} />
                  </span>
                  <span className={styles.whoRow}>
                    <span className={styles.name}>{MODULE_LABEL[m.module]}</span>
                    <span className={`${styles.muted} ${styles.line}`}>{moduleSummary(m)}</span>
                  </span>
                  <Tag tone={m.live ? "success" : "neutral"}>{m.live ? "Live" : "Off"}</Tag>
                  <Icon name="chevron-right" size={20} className={styles.chevron} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Needs>
  );
}
