"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Rows, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { ButtonLink, Card, Icon, Tag } from "@/components/ui";
import { listModules, type ModuleName, type ModuleSettings } from "@/lib/api/admin";
import { ago } from "@/lib/time";
import { DeliveryRates, ModuleCore, Rules, Withdrawals } from "../forms";
import { isGstModule, isModuleName, MODULE_LABEL } from "../labels";

function Back() {
  return (
    <Link href="/admin/modules" className={styles.back}>
      <Icon name="arrow-left" size={18} />
      All modules
    </Link>
  );
}

function NotFound({ body }: { body: string }) {
  return (
    <div className={styles.page}>
      <Back />
      <h1 className={styles.title}>Module not found</h1>
      <p className={styles.muted}>{body}</p>
      <div>
        <ButtonLink href="/admin/modules" variant="secondary">
          See all modules
        </ButtonLink>
      </div>
    </div>
  );
}

function Settings({ module }: { module: ModuleName }) {
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [m, setM] = useState<ModuleSettings | null | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    // There is no single-module read, so the list is loaded and this one picked out.
    listModules().then(
      (all) => live && setM(all.find((x) => x.module === module) ?? null),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [module, attempt, onSignedOut]);

  if (m === null) return <NotFound body="This module isn't on Ruxstar any more." />;
  // GST calls local shops "ecommerce".
  const gstModule = module === "shop" ? "ecommerce" : module;

  return (
    <div className={styles.page}>
      <Back />
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{MODULE_LABEL[module]}</h1>
          <p className={styles.muted}>
            {canManage ? "Changes apply at once and are written to the audit log." : "You can see these settings. Ask an admin to change them."}
            {m ? ` Changed ${ago(m.updatedAt)}.` : ""}
          </p>
        </div>
        {m && <Tag tone={m.live ? "success" : "neutral"}>{m.live ? "Live" : "Off"}</Tag>}
      </div>
      {error ? (
        <Failed
          error={error}
          onRetry={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        />
      ) : !m ? (
        <Rows count={3} height={220} />
      ) : (
        <>
          <ModuleCore m={m} onSaved={setM} />
          {m.payouts && (
            <Card as="section" padding="lg" className={styles.page} aria-labelledby="module-withdrawals">
              <h2 id="module-withdrawals" className={styles.subtitle}>
                Withdrawals
              </h2>
              <Withdrawals m={m} payouts={m.payouts} onSaved={setM} />
            </Card>
          )}
          {m.delivery && (
            <Card as="section" padding="lg" className={styles.page} aria-labelledby="module-delivery">
              <h2 id="module-delivery" className={styles.subtitle}>
                Delivery rates
              </h2>
              <DeliveryRates m={m} delivery={m.delivery} onSaved={setM} />
            </Card>
          )}
          <Rules m={m} onSaved={setM} />
          {isGstModule(gstModule) && (
            <Card as="section" interactive padding="lg">
              <Link href={`/admin/gst?module=${gstModule}`} className={styles.linkRow}>
                <Icon name="receipt" size={22} />
                <span className={styles.whoRow}>
                  <span className={styles.name}>GST rates and invoices</span>
                  <span className={styles.muted}>Rates, codes and who invoices for {MODULE_LABEL[module]}</span>
                </span>
                <Icon name="chevron-right" size={20} className={styles.chevron} />
              </Link>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/** One module: its switches, commission and fee, its rules, and a way to its GST settings. Same as the app. */
export function ModuleScreen({ module }: { module: string }) {
  return (
    <Needs need="modules.view">
      {isModuleName(module) ? <Settings key={module} module={module} /> : <NotFound body="This link doesn't point to a Ruxstar module." />}
    </Needs>
  );
}
