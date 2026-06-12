"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { Particles } from "@/components/particles";
import { useRequireAuth } from "@/hooks/use-require-auth";
import {
  becomeVendor,
  type CustomerProfile,
  getCustomerProfile,
  updateCustomerProfile,
} from "@/lib/api";

const input = "field-input";

export default function CustomerPage() {
  const router = useRouter();
  const { ready } = useRequireAuth({ roles: ["customer"] });

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!ready) return;
    getCustomerProfile()
      .then((data) => {
        setProfile(data);
        setName(data.name ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load profile"))
      .finally(() => setLoading(false));
  }, [ready]);

  async function onSaveName(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!name.trim()) {
      setError("Name cannot be empty.");
      return;
    }
    setSavingName(true);
    try {
      const updated = await updateCustomerProfile(name.trim());
      setProfile(updated);
      setName(updated.name ?? "");
      setEditing(false);
      setNotice("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile");
    } finally {
      setSavingName(false);
    }
  }

  async function onBecomeVendor(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setUpgrading(true);
    try {
      await becomeVendor(businessName.trim() || undefined);
      router.replace("/business");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch to a business account");
      setUpgrading(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-white/50">Loading…</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0" />
        <div className="spotlight absolute inset-0" />
        <div className="grade-overlay absolute inset-0" />
      </div>
      <Particles />

      <header className="relative z-10 mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight">Ruxstar</span>
        <LogoutButton />
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-6 pb-16">
        <div className="reveal">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Welcome back</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
            <span className="text-gradient">{profile?.name || "Your account"}</span>
          </h1>
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

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Profile</h2>
              {!editing && !loading && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-sm text-zinc-400 transition hover:text-zinc-200"
                >
                  Edit
                </button>
              )}
            </div>

            {loading ? (
              <p className="mt-6 text-sm text-zinc-500">Loading…</p>
            ) : editing ? (
              <form onSubmit={onSaveName} className="mt-6 space-y-4">
                <label className="block text-sm text-zinc-400">
                  Name
                  <input
                    className={`${input} mt-2`}
                    value={name}
                    autoComplete="name"
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setName(profile?.name ?? "");
                      setError("");
                    }}
                    className="flex-1 rounded-full border border-white/10 py-2.5 text-sm hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingName}
                    className="btn-primary flex-1 rounded-full py-2.5 text-sm font-semibold disabled:opacity-60"
                  >
                    {savingName ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            ) : (
              <dl className="mt-6 space-y-4 text-sm">
                <div>
                  <dt className="text-zinc-500">Name</dt>
                  <dd className="mt-0.5 text-zinc-100">{profile?.name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Mobile</dt>
                  <dd className="mt-0.5 text-zinc-100">
                    {profile?.mobile ? `+91 ${profile.mobile}` : "—"}
                  </dd>
                </div>
              </dl>
            )}
          </section>

          <section className="glass rounded-2xl p-6">
            <h2 className="text-lg font-medium">Grow with Ruxstar</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Open your vendor dashboard, complete KYC, then onboard multiple businesses.
              Your customer profile stays safe — switch back anytime.
            </p>

            <form onSubmit={onBecomeVendor} className="mt-6 space-y-4">
              <label className="block text-sm text-zinc-400">
                Business name <span className="text-zinc-600">(optional)</span>
                <input
                  className={`${input} mt-2`}
                  value={businessName}
                  placeholder={profile?.name ? `${profile.name}'s business` : "Your business name"}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={upgrading}
                className="btn-primary w-full rounded-full py-3 text-sm font-semibold disabled:opacity-60"
              >
                {upgrading ? "Switching…" : "Become a business"}
              </button>
            </form>
          </section>
        </div>

        <div className="mt-6">
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-sm text-zinc-500">Orders &amp; services — coming soon</p>
          </div>
        </div>
      </main>
    </div>
  );
}
