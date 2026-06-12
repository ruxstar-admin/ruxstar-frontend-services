"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { Particles } from "@/components/particles";
import { useRequireAuth } from "@/hooks/use-require-auth";
import {
  becomeCustomer,
  createVendorCustomer,
  getVendorKycStatus,
  getVendorProfile,
  listVendorCustomers,
  updateVendorProfile,
  type VendorCustomer,
  type VendorKycStatus,
  type VendorProfile,
} from "@/lib/api";

const input = "field-input";

const kycCopy: Record<string, { title: string; body: string; cta: string | null }> = {
  pending: {
    title: "Complete KYC to add your business",
    body: "Verify your identity (Aadhaar, PAN and a selfie) to unlock your business profile and start onboarding customers.",
    cta: "Start KYC",
  },
  in_progress: {
    title: "Finish your KYC",
    body: "You've started verification but a few steps are pending. Complete them to unlock your business.",
    cta: "Continue KYC",
  },
  rejected: {
    title: "KYC needs attention",
    body: "Your verification was rejected. Please review and resubmit the requested details.",
    cta: "Fix KYC",
  },
  pending_review: {
    title: "KYC under review",
    body: "Your documents are with our team. You'll get full access as soon as they're approved.",
    cta: null,
  },
};

export default function BusinessPage() {
  const router = useRouter();
  const { user, ready } = useRequireAuth({ roles: ["vendor"] });

  const [kyc, setKyc] = useState<VendorKycStatus | null>(null);
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [customers, setCustomers] = useState<VendorCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<VendorProfile>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [custName, setCustName] = useState("");
  const [custMobile, setCustMobile] = useState("");
  const [custPassword, setCustPassword] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);

  const [switching, setSwitching] = useState(false);

  const verified = kyc?.status === "verified";

  const loadVerifiedData = useCallback(async () => {
    const [profileData, customerData] = await Promise.all([
      getVendorProfile(),
      listVendorCustomers(),
    ]);
    setProfile(profileData);
    setForm(profileData);
    setCustomers(customerData);
  }, []);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const status = await getVendorKycStatus();
        setKyc(status);
        if (status.status === "verified") {
          await loadVerifiedData();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load your business");
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, loadVerifiedData]);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!form.businessName?.trim()) {
      setError("Business name is required.");
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await updateVendorProfile({
        businessName: form.businessName.trim(),
        category: form.category?.trim() || undefined,
        description: form.description?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        address: form.address?.trim() || undefined,
      });
      setProfile(updated);
      setForm(updated);
      setEditing(false);
      setNotice("Business profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!custName.trim()) return setError("Enter the customer's name.");
    if (custMobile.length !== 10) return setError("Enter a 10-digit mobile number.");
    if (custPassword.length < 6) return setError("Password must be at least 6 characters.");

    setAddingCustomer(true);
    try {
      await createVendorCustomer({
        name: custName.trim(),
        mobile: custMobile,
        password: custPassword,
      });
      setCustName("");
      setCustMobile("");
      setCustPassword("");
      setCustomers(await listVendorCustomers());
      setNotice("Customer added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add customer");
    } finally {
      setAddingCustomer(false);
    }
  }

  async function onSwitchToCustomer() {
    setSwitching(true);
    setError("");
    try {
      await becomeCustomer();
      router.replace("/customer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch account");
      setSwitching(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-white/50">Loading…</p>
      </div>
    );
  }

  const status = kyc?.status ?? "pending";
  const gate = kycCopy[status] ?? kycCopy.pending;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0" />
        <div className="spotlight absolute inset-0" />
        <div className="grade-overlay absolute inset-0" />
      </div>
      <Particles />

      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/business" className="text-lg font-semibold tracking-tight">
          Ruxstar Business
        </Link>
        <LogoutButton />
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-16">
        <div className="reveal flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500">Business dashboard</p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
              <span className="text-gradient">
                {profile?.businessName || user?.name || "Your business"}
              </span>
            </h1>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
              verified
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                : status === "rejected"
                  ? "border-red-500/25 bg-red-500/10 text-red-200"
                  : "border-amber-500/25 bg-amber-500/10 text-amber-100"
            }`}
          >
            {verified ? "Verified" : `KYC ${status.replace("_", " ")}`}
          </span>
        </div>

        {error && (
          <p className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {notice}
          </p>
        )}

        {loading ? (
          <p className="mt-10 text-center text-sm text-zinc-500">Loading your business…</p>
        ) : !verified ? (
          <section className="mt-8 glass rounded-2xl p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl">
              {status === "rejected" ? "!" : "🔒"}
            </div>
            <h2 className="mt-4 text-xl font-medium">{gate.title}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">{gate.body}</p>
            {kyc?.rejectReason && (
              <p className="mt-3 text-sm text-red-200/90">Reason: {kyc.rejectReason}</p>
            )}
            {gate.cta && (
              <Link
                href="/business/kyc"
                className="btn-primary mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
              >
                {gate.cta}
              </Link>
            )}
          </section>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Business profile</h2>
                {!editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="text-sm text-zinc-400 transition hover:text-zinc-200"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editing ? (
                <form onSubmit={onSaveProfile} className="mt-6 space-y-4">
                  <label className="block text-sm text-zinc-400">
                    Business name
                    <input
                      className={`${input} mt-2`}
                      value={form.businessName ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                    />
                  </label>
                  <label className="block text-sm text-zinc-400">
                    Category
                    <input
                      className={`${input} mt-2`}
                      value={form.category ?? ""}
                      placeholder="e.g. Salon, Bakery, Repairs"
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    />
                  </label>
                  <label className="block text-sm text-zinc-400">
                    Phone
                    <input
                      className={`${input} mt-2`}
                      inputMode="numeric"
                      value={form.phone ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))
                      }
                    />
                  </label>
                  <label className="block text-sm text-zinc-400">
                    Address
                    <input
                      className={`${input} mt-2`}
                      value={form.address ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    />
                  </label>
                  <label className="block text-sm text-zinc-400">
                    About
                    <textarea
                      className={`${input} mt-2 min-h-20`}
                      value={form.description ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(false);
                        setForm(profile ?? {});
                        setError("");
                      }}
                      className="flex-1 rounded-full border border-white/10 py-2.5 text-sm hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="btn-primary flex-1 rounded-full py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      {savingProfile ? "Saving…" : "Save"}
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="mt-6 space-y-4 text-sm">
                  <div>
                    <dt className="text-zinc-500">Name</dt>
                    <dd className="mt-0.5 text-zinc-100">{profile?.businessName || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Category</dt>
                    <dd className="mt-0.5 text-zinc-100">{profile?.category || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Phone</dt>
                    <dd className="mt-0.5 text-zinc-100">{profile?.phone || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Address</dt>
                    <dd className="mt-0.5 text-zinc-100">{profile?.address || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">About</dt>
                    <dd className="mt-0.5 text-zinc-100">{profile?.description || "—"}</dd>
                  </div>
                </dl>
              )}
            </section>

            <section className="glass rounded-2xl p-6">
              <h2 className="text-lg font-medium">Customers</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {customers.length} customer{customers.length === 1 ? "" : "s"} onboarded.
              </p>

              {customers.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {customers.map((c) => (
                    <li
                      key={c.id ?? c.mobile}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm"
                    >
                      <span className="font-medium text-zinc-200">{c.name ?? "Customer"}</span>
                      <span className="text-zinc-500">+91 {c.mobile ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={onAddCustomer} className="mt-6 space-y-3 border-t border-white/5 pt-6">
                <p className="text-sm font-medium text-zinc-300">Add a customer</p>
                <input
                  className={input}
                  placeholder="Name"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                />
                <input
                  className={input}
                  placeholder="Mobile (+91)"
                  inputMode="numeric"
                  value={custMobile}
                  onChange={(e) => setCustMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                />
                <input
                  className={input}
                  type="password"
                  placeholder="Temp password (min 6)"
                  value={custPassword}
                  onChange={(e) => setCustPassword(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={addingCustomer}
                  className="btn-primary w-full rounded-full py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {addingCustomer ? "Adding…" : "Add customer"}
                </button>
              </form>
            </section>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-6 py-4">
          <div>
            <p className="text-sm font-medium text-zinc-200">Switch to a customer account</p>
            <p className="text-xs text-zinc-500">
              Your business details and KYC stay saved — switch back anytime.
            </p>
          </div>
          <button
            type="button"
            onClick={onSwitchToCustomer}
            disabled={switching}
            className="rounded-full border border-white/10 px-5 py-2 text-sm transition hover:bg-white/5 disabled:opacity-60"
          >
            {switching ? "Switching…" : "Switch"}
          </button>
        </div>
      </main>
    </div>
  );
}
