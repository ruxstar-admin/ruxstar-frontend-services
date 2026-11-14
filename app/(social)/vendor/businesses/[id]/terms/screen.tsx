"use client";

import { PaymentTerms } from "@/components/shop/PaymentTerms";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { getPodTerms, vendorTerms } from "@/lib/api/terms";
import styles from "@/components/vendor/vendor.module.css";

/** The payment terms a print shop agreed to when it was created, as Ruxstar has them set now. Same as the app. */
export function PaymentTermsScreen({ id }: { id: string }) {
  const { data, error, reload } = useLoad(getPodTerms);
  if (error && !data) return <Failed error={error} onRetry={reload} />;
  if (!data) return <Loading rows={4} />;
  return (
    <div className={styles.page}>
      <Back href={`/vendor/businesses/${id}`}>Business</Back>
      <h1 className={styles.title}>Payment terms</h1>
      <p className={styles.intro}>How print orders are paid, refunded and paid out to you, with Ruxstar&apos;s current commission and fees.</p>
      <PaymentTerms terms={vendorTerms(data)} />
    </div>
  );
}
