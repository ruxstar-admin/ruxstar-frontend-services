"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { useOnSignedOut } from "@/components/social/session";
import { BusinessFields } from "@/components/vendor/BusinessFields";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import {
  checkProfile,
  createBusiness,
  EMPTY_PROFILE,
  locationOf,
  MODULE_ICON,
  profileFieldOf,
  TYPE_ICON,
  vendorCatalog,
  type BusinessCategory,
  type BusinessModule,
  type ProfileErrors,
  type ProfileValues,
} from "@/lib/api/vendor";
import styles from "@/components/vendor/vendor.module.css";

type BusinessType = BusinessCategory["types"][number]["id"];

const closedNote = (c: BusinessCategory) => (c.live ? "Not taking new businesses right now" : "Coming soon");

/** As in the app: pick a category, then the kind of business, then its profile. It starts as a draft you set up and publish. */
export function CreateBusinessScreen() {
  const router = useRouter();
  const onSignedOut = useOnSignedOut();
  const catalog = useLoad(() => vendorCatalog(true));
  const [module, setModule] = useState<BusinessModule | null>(null);
  const [type, setType] = useState<BusinessType | null>(null);
  const [values, setValues] = useState<ProfileValues>(EMPTY_PROFILE);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // One key per attempt to create, so a retry after a dropped connection can't make two.
  const attempt = useRef(newIdempotencyKey());

  if (catalog.error && !catalog.data) return <Failed error={catalog.error} onRetry={catalog.reload} />;
  if (!catalog.data) return <Loading />;
  const data = catalog.data;

  const category = data.categories.find((c) => c.module === module) ?? null;
  const typeInfo = category?.types.find((t) => t.id === type) ?? null;

  const chooseCategory = (c: BusinessCategory) => {
    setModule(c.module);
    // A category with one kind of business skips the type step.
    setType(c.types.length === 1 ? c.types[0]!.id : null);
  };

  const change = (patch: Partial<ProfileValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) }));
  };

  const create = async () => {
    if (!module || !type) return;
    const found = checkProfile(values);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const business = await createBusiness(
        { module, type, name: values.name.trim(), phone: values.phone, location: locationOf(values), description: values.description.trim() || null },
        attempt.current,
      );
      router.replace(`/vendor/businesses/${business.id}`);
    } catch (err) {
      setSaving(false);
      if (onSignedOut(err)) return;
      if (err instanceof ApiError && err.code !== "NETWORK") attempt.current = newIdempotencyKey();
      const detail = err instanceof ApiError ? err.details.find((d) => profileFieldOf(d.path)) : undefined;
      const field = profileFieldOf(detail?.path);
      if (detail && field) setErrors({ [field]: detail.message });
      else setFailure(formError(err).message);
      if (err instanceof ApiError && (err.code === "MODULE_OFF" || err.code === "SIGNUPS_CLOSED")) {
        setModule(null);
        setType(null);
        catalog.reload();
      }
    }
  };

  const step = !category ? "category" : !typeInfo ? "type" : "profile";

  return (
    <div className={styles.page}>
      <Back href="/vendor/businesses">Businesses</Back>
      <h1 className={styles.title}>{step === "category" ? "Add a business" : step === "type" ? category!.label : "Business profile"}</h1>

      {step === "category" && (
        <>
          <p className={styles.intro}>Choose what your business does. Each business runs in one category.</p>
          <div className={styles.options}>
            {data.categories.map((c) => (
              <button key={c.module} type="button" className={styles.option} disabled={!c.signupsOpen} onClick={() => chooseCategory(c)}>
                <Icon name={MODULE_ICON[c.module]} size={26} />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{c.label}</span>
                  <span className={styles.muted}>{c.signupsOpen ? c.description : closedNote(c)}</span>
                </span>
                {c.signupsOpen && <Icon name="chevron-right" size={18} />}
              </button>
            ))}
          </div>
        </>
      )}

      {category && step === "type" && (
        <>
          <p className={styles.intro}>What kind of business is it?</p>
          <div className={styles.options}>
            {category.types.map((t) => (
              <button key={t.id} type="button" className={styles.option} onClick={() => setType(t.id)}>
                <Icon name={TYPE_ICON[t.id]} size={26} />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{t.label}</span>
                  <span className={styles.muted}>{t.description}</span>
                  <span className={styles.faint}>{t.examples}</span>
                </span>
                <Icon name="chevron-right" size={18} />
              </button>
            ))}
          </div>
          <div>
            <button type="button" className={styles.link} data-muted onClick={() => setModule(null)}>
              Choose another category
            </button>
          </div>
        </>
      )}

      {category && typeInfo && step === "profile" && (
        <form
          className={styles.form}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <div className={styles.chosen}>
            <span className={styles.identity}>
              <span className={styles.faint}>{category.label}</span>
              <strong>{typeInfo.label}</strong>
            </span>
            <button
              type="button"
              className={styles.link}
              onClick={() => {
                setType(null);
                if (category.types.length === 1) setModule(null);
              }}
            >
              Change
            </button>
          </div>
          <BusinessFields
            values={values}
            errors={errors}
            onChange={change}
            states={data.states}
            namePlaceholder={typeInfo.namePlaceholder}
            detailHint={typeInfo.detailHint}
          />
          <p className={styles.faint}>{`You add photos${module === "pod" ? ", products and prices" : ""} next, then publish it.`}</p>
          {failure && (
            <p className={styles.error} role="alert">
              {failure}
            </p>
          )}
          <div>
            <Button type="submit" size="lg" loading={saving}>
              Create business
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
