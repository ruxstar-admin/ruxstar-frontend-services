"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { useOnSignedOut } from "@/components/social/session";
import { BusinessFields } from "@/components/vendor/BusinessFields";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import {
  checkProfile,
  GSTIN,
  locationOf,
  profileFieldOf,
  profileOf,
  shopDesk,
  vendorCatalog,
  type Business,
  type BusinessCatalog,
  type ProfileErrors,
  type ProfileValues,
} from "@/lib/api/vendor";
import styles from "@/components/vendor/vendor.module.css";

type Errors = ProfileErrors & { gstin?: string };

function Form({ id, team, business, catalog }: { id: string; team: boolean; business: Business; catalog: BusinessCatalog }) {
  const router = useRouter();
  const onSignedOut = useOnSignedOut();
  const [values, setValues] = useState<ProfileValues>(() => profileOf(business));
  const [gstin, setGstin] = useState(business.gstin?.number ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const typeInfo = catalog.categories.flatMap((c) => c.types).find((t) => t.id === business.type);
  const desk = shopDesk(team);
  const back = desk.home(id);

  const change = (patch: Partial<ProfileValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) }));
  };

  const save = async () => {
    const found: Errors = checkProfile(values);
    if (!team && gstin && !GSTIN.test(gstin)) found.gstin = "A GSTIN has 15 characters, like 36ABCDE1234F1Z5. Or leave it empty.";
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await desk.update(id, {
        name: values.name.trim(),
        description: values.description.trim() || null,
        phone: values.phone,
        location: locationOf(values),
        // Only sent when changed: the API checks it with the GST network each time.
        ...(!team && gstin !== (business.gstin?.number ?? "") ? { gstin: gstin || null } : {}),
      });
      router.push(back);
    } catch (err) {
      setSaving(false);
      if (onSignedOut(err)) return;
      const details = err instanceof ApiError ? err.details : [];
      const gst = details.find((d) => d.path?.endsWith("gstin"));
      const detail = details.find((d) => profileFieldOf(d.path));
      const field = profileFieldOf(detail?.path);
      if (gst) setErrors({ gstin: gst.message });
      else if (detail && field) setErrors({ [field]: detail.message });
      else if (err instanceof ApiError && err.code === "BUSINESS_INCOMPLETE") setFailure("A live business needs a phone number and location.");
      else setFailure(formError(err).message);
    }
  };

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <BusinessFields
        values={values}
        errors={errors}
        onChange={change}
        states={catalog.states}
        namePlaceholder={typeInfo?.namePlaceholder}
        detailHint={typeInfo?.detailHint}
      />
      {!team && (
        <Input
          label={business.missing.includes("gstin") ? "GSTIN, needed to publish" : "GSTIN (optional)"}
          value={gstin}
          onChange={(e) => {
            setGstin(e.target.value.toUpperCase().replace(/\s/g, "").slice(0, 15));
            setErrors((x) => ({ ...x, gstin: undefined }));
          }}
          error={errors.gstin}
          hint="We check a GSTIN with the GST network when you save."
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={15}
        />
      )}
      {failure && (
        <p className={styles.error} role="alert">
          {failure}
        </p>
      )}
      <div>
        <Button type="submit" size="lg" loading={saving}>
          Save details
        </Button>
      </div>
    </form>
  );
}

/** Everything customers read about a business. Same as the app. `team` opens it from Work, where `id` is the place there. */
export function BusinessDetailsScreen({ id, team = false }: { id: string; team?: boolean }) {
  const business = useLoad(() => shopDesk(team).get(id), id);
  const catalog = useLoad(() => vendorCatalog());
  const error = business.error ?? catalog.error;
  if (error && !(business.data && catalog.data)) {
    return (
      <Failed
        error={error}
        onRetry={() => {
          if (business.error) business.reload();
          if (catalog.error) catalog.reload();
        }}
      />
    );
  }
  if (!business.data || !catalog.data) return <Loading rows={5} />;
  return (
    <div className={styles.page}>
      <Back href={shopDesk(team).home(id)}>{business.data.name}</Back>
      <h1 className={styles.title}>Business details</h1>
      <Form id={id} team={team} business={business.data} catalog={catalog.data} />
    </div>
  );
}
