"use client";

import { useState } from "react";
import type { CreatorOffer, CreatorOfferInput, CreatorOfferKind } from "@/lib/api";

const input = "field-input";

const KINDS: { id: CreatorOfferKind; label: string }[] = [
  { id: "shoutout", label: "Shoutout" },
  { id: "collab", label: "Collab" },
  { id: "appearance", label: "Appearance" },
];

const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "other", label: "Other" },
];

type Props = {
  businessId: string;
  initial?: Partial<CreatorOffer>;
  onSubmit: (body: CreatorOfferInput, opts: { publish: boolean }) => Promise<void>;
  onCancel: () => void;
};

export function VendorCreatorOfferForm({ businessId, initial, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [kind, setKind] = useState<CreatorOfferKind>(initial?.kind ?? "collab");
  const [platforms, setPlatforms] = useState<string[]>(initial?.platforms ?? ["instagram"]);
  const [price, setPrice] = useState(initial?.price ? String(initial.price) : "");
  const [turnaroundDays, setTurnaroundDays] = useState(
    initial?.turnaroundDays ? String(initial.turnaroundDays) : "7",
  );
  const [capacity, setCapacity] = useState(initial?.capacity ? String(initial.capacity) : "");
  const [busy, setBusy] = useState<"" | "draft" | "publish">("");
  const [error, setError] = useState("");

  function togglePlatform(id: string) {
    setPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id].slice(0, 5),
    );
  }

  async function save(publish: boolean) {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required.");
      return;
    }
    const p = Math.round(Number(price));
    if (!Number.isFinite(p) || p < 1) {
      setError("Price must be at least ₹1.");
      return;
    }
    setBusy(publish ? "publish" : "draft");
    setError("");
    try {
      await onSubmit(
        {
          businessId,
          title: trimmed,
          description: description.trim(),
          kind,
          platforms,
          price: p,
          turnaroundDays: turnaroundDays.trim()
            ? Math.round(Number(turnaroundDays))
            : null,
          capacity: capacity.trim() ? Math.round(Number(capacity)) : null,
        },
        { publish },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save offer.");
      setBusy("");
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(true);
      }}
      className="space-y-4"
    >
      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <input
        className={input}
        placeholder="Offer title (e.g. Instagram reel shoutout)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        className={`${input} min-h-[5rem] resize-none`}
        placeholder="What the customer gets, deliverables, and any rules."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Type</p>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                kind === k.id
                  ? "border-pink-500/30 bg-pink-500/10 text-pink-200"
                  : "border-white/10 text-zinc-400"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Platforms</p>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePlatform(p.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                platforms.includes(p.id)
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-white/10 text-zinc-400"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs text-zinc-500">Price (₹)</span>
          <input
            className={`${input} mt-1`}
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">Turnaround (days)</span>
          <input
            className={`${input} mt-1`}
            inputMode="numeric"
            value={turnaroundDays}
            onChange={(e) => setTurnaroundDays(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">Capacity (optional)</span>
          <input
            className={`${input} mt-1`}
            inputMode="numeric"
            placeholder="Unlimited"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-zinc-300"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy !== ""}
          onClick={() => void save(false)}
          className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-zinc-300 disabled:opacity-50"
        >
          {busy === "draft" ? "Saving…" : "Save as draft"}
        </button>
        <button
          type="submit"
          disabled={busy !== ""}
          className="btn-primary rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {busy === "publish" ? "Publishing…" : "Publish to Discover"}
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Only published offers appear in customer Discover. Drafts stay private.
      </p>
    </form>
  );
}
