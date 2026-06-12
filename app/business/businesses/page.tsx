"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useVendorShell } from "@/components/vendor-shell";
import {
  emptyBusinessForm,
  loadVendorBusinesses,
  saveVendorBusinesses,
  type VendorBusiness,
} from "@/lib/vendor-businesses";

const input = "field-input";

export default function VendorBusinessesPage() {
  const { user, kycVerified, kyc } = useVendorShell();
  const userId = user?.id ?? user?._id ?? "";

  const [businesses, setBusinesses] = useState<VendorBusiness[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyBusinessForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (userId) setBusinesses(loadVendorBusinesses(userId));
  }, [userId]);

  if (!kycVerified) {
    const status = kyc?.status ?? "pending";
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold">Complete KYC first</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Business onboarding is locked until your identity is verified.
            {status === "pending_review" && " Your KYC is under admin review."}
          </p>
          {kyc?.rejectReason && (
            <p className="mt-3 text-sm text-red-200/90">Reason: {kyc.rejectReason}</p>
          )}
          <Link
            href="/business/kyc"
            className="btn-primary mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            {status === "pending_review" ? "View KYC status" : "Go to KYC verification"}
          </Link>
        </div>
      </div>
    );
  }

  function onAddBusiness(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!form.name.trim()) {
      setError("Business name is required.");
      return;
    }

    const entry: VendorBusiness = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      category: form.category.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      description: form.description.trim(),
      createdAt: new Date().toISOString(),
    };

    const next = [entry, ...businesses];
    setBusinesses(next);
    saveVendorBusinesses(userId, next);
    setForm(emptyBusinessForm);
    setShowAdd(false);
    setNotice(`"${entry.name}" added successfully.`);
  }

  function onRemove(id: string) {
    const next = businesses.filter((b) => b.id !== id);
    setBusinesses(next);
    saveVendorBusinesses(userId, next);
    setNotice("Business removed.");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">Businesses</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
            <span className="text-gradient">My businesses</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Onboard and manage multiple businesses from one account.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAdd(true);
            setError("");
          }}
          className="btn-primary rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          + Add business
        </button>
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

      {businesses.length === 0 ? (
        <div className="mt-8 glass rounded-2xl p-12 text-center">
          <p className="text-4xl">🏪</p>
          <h2 className="mt-4 text-lg font-medium">No businesses yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-400">
            Add your first business to get started on Ruxstar.
          </p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="btn-primary mt-6 rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            Add your first business
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {businesses.map((biz) => (
            <article key={biz.id} className="glass group rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-zinc-100">{biz.name}</h3>
                  {biz.category && <p className="text-sm text-zinc-500">{biz.category}</p>}
                </div>
                <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-200">
                  Active
                </span>
              </div>
              <dl className="mt-4 space-y-1 text-sm text-zinc-400">
                {biz.phone && <p>+91 {biz.phone}</p>}
                {biz.address && <p className="truncate">{biz.address}</p>}
                {biz.description && <p className="line-clamp-2">{biz.description}</p>}
              </dl>
              <div className="mt-4 flex justify-between border-t border-white/5 pt-3 text-xs text-zinc-600">
                <span>Added {new Date(biz.createdAt).toLocaleDateString()}</span>
                <button
                  type="button"
                  onClick={() => onRemove(biz.id)}
                  className="text-zinc-500 opacity-0 transition hover:text-red-300 group-hover:opacity-100"
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setShowAdd(false)}
        >
          <div
            className="glass w-full max-w-lg rounded-2xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold">Add a business</h2>
            <form onSubmit={onAddBusiness} className="mt-6 space-y-4">
              <label className="block text-sm text-zinc-400">
                Business name
                <input
                  className={`${input} mt-2`}
                  value={form.name}
                  autoFocus
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
              <label className="block text-sm text-zinc-400">
                Category
                <input
                  className={`${input} mt-2`}
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                />
              </label>
              <label className="block text-sm text-zinc-400">
                Phone
                <input
                  className={`${input} mt-2`}
                  inputMode="numeric"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))
                  }
                />
              </label>
              <label className="block text-sm text-zinc-400">
                Address
                <input
                  className={`${input} mt-2`}
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </label>
              <label className="block text-sm text-zinc-400">
                About
                <textarea
                  className={`${input} mt-2 min-h-20`}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdd(false);
                    setForm(emptyBusinessForm);
                  }}
                  className="flex-1 rounded-full border border-white/10 py-2.5 text-sm hover:bg-white/5"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 rounded-full py-2.5 text-sm font-semibold">
                  Add business
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
