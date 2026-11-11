"use client";

import { useState, type FormEvent } from "react";
import { Button, Input } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { GSTIN, PINCODE, saveVendor, type Overview, type VendorCase } from "@/lib/api/kyc";
import styles from "./verify.module.css";

type Fields = "businessName" | "line1" | "line2" | "city" | "state" | "pincode" | "gstin";

const fromCase = (business: VendorCase["business"]): Record<Fields, string> => ({
  businessName: business?.name ?? "",
  line1: business?.address.line1 ?? "",
  line2: business?.address.line2 ?? "",
  city: business?.address.city ?? "",
  state: business?.address.state ?? "",
  pincode: business?.address.pincode ?? "",
  gstin: business?.gstin?.number ?? "",
});

function check(v: Record<Fields, string>): Partial<Record<Fields, string>> {
  const e: Partial<Record<Fields, string>> = {};
  if (v.businessName.trim().length < 2) e.businessName = "Enter your business name.";
  if (v.line1.trim().length < 3) e.line1 = "Enter the shop or building and street.";
  if (v.city.trim().length < 2) e.city = "Enter the city.";
  if (v.state.trim().length < 2) e.state = "Enter the state.";
  if (!PINCODE.test(v.pincode)) e.pincode = "Enter the 6-digit PIN code.";
  if (v.gstin && !GSTIN.test(v.gstin)) e.gstin = "A GSTIN has 15 characters, like 36ABCDE1234F1Z5. Or leave it empty.";
  return e;
}

/** Business details for vendor verification. Saving checks the GSTIN; sending for review is a separate step. */
export function VendorForm({ vendor, onSaved, onSignedOut }: { vendor: VendorCase; onSaved: (o: Overview) => void; onSignedOut: (err: unknown) => boolean }) {
  const [values, setValues] = useState(() => fromCase(vendor.business));
  const [errors, setErrors] = useState<Partial<Record<Fields, string>>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (field: Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = field === "gstin" ? e.target.value.toUpperCase().replace(/\s/g, "") : field === "pincode" ? e.target.value.replace(/\D/g, "") : e.target.value;
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((x) => ({ ...x, [field]: undefined }));
  };

  async function save(event: FormEvent) {
    event.preventDefault();
    const found = check(values);
    setErrors(found);
    setFormErr(null);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      onSaved(
        await saveVendor({
          businessName: values.businessName.trim(),
          address: {
            line1: values.line1.trim(),
            line2: values.line2.trim() || null,
            city: values.city.trim(),
            state: values.state.trim(),
            pincode: values.pincode,
          },
          gstin: values.gstin || null,
        }),
      );
    } catch (err) {
      if (onSignedOut(err)) return;
      const { message, field } = formError(err);
      if (field && field in values) setErrors({ [field]: message });
      else if (field?.startsWith("address/")) setErrors({ [field.slice(8) as Fields]: message });
      else setFormErr(message);
    } finally {
      setSaving(false);
    }
  }

  const field = (name: Fields, label: string, extra: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <Input label={label} value={values[name]} onChange={set(name)} error={errors[name]} {...extra} />
  );

  return (
    <form className={styles.form} onSubmit={save} noValidate>
      {field("businessName", "Business name", { autoComplete: "organization", maxLength: 80 })}
      {field("line1", "Address", { autoComplete: "address-line1", maxLength: 120, placeholder: "Shop number, building, street" })}
      {field("line2", "Area or landmark (optional)", { autoComplete: "address-line2", maxLength: 120 })}
      <div className={styles.row}>
        {field("city", "City", { autoComplete: "address-level2", maxLength: 60 })}
        {field("state", "State", { autoComplete: "address-level1", maxLength: 60 })}
      </div>
      <div className={styles.row}>
        {field("pincode", "PIN code", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 6 })}
        {field("gstin", "GSTIN (optional)", { maxLength: 15, autoCapitalize: "characters", spellCheck: false })}
      </div>
      {formErr && (
        <p className={styles.error} role="alert">
          {formErr}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" variant={vendor.business ? "secondary" : "primary"} loading={saving}>
          {vendor.business ? "Save changes" : "Save details"}
        </Button>
      </div>
    </form>
  );
}
