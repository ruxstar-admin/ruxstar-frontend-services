"use client";

import { useMemo, useState } from "react";
import { useAdminShell } from "@/components/admin-shell";
import {
  createAdminCategory,
  createAdminType,
  updateAdminCategory,
  updateAdminType,
  type AdminCatalogCategory,
  type AdminCatalogType,
  type BusinessModule,
} from "@/lib/api";
import { invalidateAdminCatalog, useAdminCatalog, useBusinessCatalog } from "@/lib/swr-hooks";

const input = "field-input";

export default function AdminCatalogPage() {
  const { isAdmin } = useAdminShell();
  const { data, isLoading, error } = useAdminCatalog(true);
  const { data: publicCatalog } = useBusinessCatalog();
  const [actionError, setActionError] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  const moduleOptions = useMemo<{ id: string; label: string }[]>(() => {
    const map = publicCatalog?.modules ?? {};
    const entries = Object.entries(map);
    if (entries.length) return entries.map(([id, label]) => ({ id, label }));
    return [
      { id: "appointments", label: "Appointments" },
      { id: "events", label: "Events" },
      { id: "services", label: "Services" },
      { id: "commerce", label: "Commerce" },
      { id: "creator", label: "Creator" },
    ];
  }, [publicCatalog]);

  const grouped = useMemo(() => {
    const cats = [...(data?.categories ?? [])].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label),
    );
    const typesByCat = new Map<string, AdminCatalogType[]>();
    for (const t of data?.types ?? []) {
      const arr = typesByCat.get(t.categoryId) ?? [];
      arr.push(t);
      typesByCat.set(t.categoryId, arr);
    }
    for (const arr of typesByCat.values()) {
      arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label));
    }
    return { cats, typesByCat };
  }, [data]);

  async function runMutation(fn: () => Promise<unknown>) {
    setActionError("");
    try {
      await fn();
      await invalidateAdminCatalog();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
      return false;
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold">Admins only</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Catalog editing is restricted to admin accounts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">Catalog</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Categories & types</h1>
          <p className="mt-1 text-sm text-zinc-400">
            What vendors can choose when onboarding a business. Inactive items are hidden from them.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreatingCategory((v) => !v)}
          className="btn-primary rounded-full px-5 py-2 text-sm font-semibold"
        >
          {creatingCategory ? "Close" : "+ Category"}
        </button>
      </div>

      {actionError && (
        <p className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {actionError}
        </p>
      )}

      {creatingCategory && (
        <div className="mt-6">
          <CategoryForm
            onCancel={() => setCreatingCategory(false)}
            onSubmit={async (body) => {
              const ok = await runMutation(() => createAdminCategory(body));
              if (ok) setCreatingCategory(false);
            }}
          />
        </div>
      )}

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.03] p-8 text-center text-sm text-red-300">
            Couldn&apos;t load the catalog. Please refresh.
          </div>
        ) : grouped.cats.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-sm text-zinc-400">
            No categories yet. Add one to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.cats.map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                types={grouped.typesByCat.get(cat.id) ?? []}
                moduleOptions={moduleOptions}
                runMutation={runMutation}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Pill({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        active
          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
          : "border-zinc-500/25 bg-zinc-500/10 text-zinc-400"
      }`}
    >
      {active ? "Active" : "Hidden"}
    </span>
  );
}

function CategoryCard({
  category,
  types,
  moduleOptions,
  runMutation,
}: {
  category: AdminCatalogCategory;
  types: AdminCatalogType[];
  moduleOptions: { id: string; label: string }[];
  runMutation: (fn: () => Promise<unknown>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [addingType, setAddingType] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    await runMutation(() => updateAdminCategory(category.id, { active: !category.active }));
    setBusy(false);
  }

  return (
    <article className="glass rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{category.icon || "🏪"}</span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium text-zinc-100">{category.label}</h2>
              <Pill active={category.active} />
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              {category.id} · {types.length} type{types.length === 1 ? "" : "s"}
            </p>
            {category.description && (
              <p className="mt-1 text-sm text-zinc-400">{category.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={toggleActive}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-60"
          >
            {category.active ? "Hide" : "Activate"}
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300 hover:bg-white/5"
          >
            {editing ? "Close" : "Edit"}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-4">
          <CategoryForm
            initial={category}
            onCancel={() => setEditing(false)}
            onSubmit={async (body) => {
              const ok = await runMutation(() => updateAdminCategory(category.id, body));
              if (ok) setEditing(false);
            }}
          />
        </div>
      )}

      {/* Types */}
      <div className="mt-4 border-t border-white/5 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Types</p>
          <button
            type="button"
            onClick={() => setAddingType((v) => !v)}
            className="text-xs text-emerald-300 hover:text-emerald-200"
          >
            {addingType ? "Close" : "+ Add type"}
          </button>
        </div>

        {addingType && (
          <div className="mt-3">
            <TypeForm
              categoryId={category.id}
              moduleOptions={moduleOptions}
              onCancel={() => setAddingType(false)}
              onSubmit={async (body) => {
                const ok = await runMutation(() => createAdminType(body));
                if (ok) setAddingType(false);
              }}
            />
          </div>
        )}

        {types.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">No types in this category yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {types.map((type) => (
              <TypeRow
                key={type.id}
                type={type}
                moduleOptions={moduleOptions}
                runMutation={runMutation}
              />
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function TypeRow({
  type,
  moduleOptions,
  runMutation,
}: {
  type: AdminCatalogType;
  moduleOptions: { id: string; label: string }[];
  runMutation: (fn: () => Promise<unknown>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const moduleLabel = moduleOptions.find((m) => m.id === type.module)?.label ?? type.module;

  async function toggleActive() {
    setBusy(true);
    await runMutation(() => updateAdminType(type.id, { active: !type.active }));
    setBusy(false);
  }

  return (
    <li className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-zinc-100">{type.label}</p>
            <Pill active={type.active} />
          </div>
          <p className="truncate text-xs text-zinc-500">
            {type.id} · {moduleLabel}
            {type.examples ? ` · e.g. ${type.examples}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={toggleActive}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-60"
          >
            {type.active ? "Hide" : "Activate"}
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300 hover:bg-white/5"
          >
            {editing ? "Close" : "Edit"}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3">
          <TypeForm
            categoryId={type.categoryId}
            moduleOptions={moduleOptions}
            initial={type}
            onCancel={() => setEditing(false)}
            onSubmit={async (body) => {
              const ok = await runMutation(() => updateAdminType(type.id, body));
              if (ok) setEditing(false);
            }}
          />
        </div>
      )}
    </li>
  );
}

function CategoryForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: AdminCatalogCategory;
  onSubmit: (body: {
    label: string;
    description: string;
    icon: string;
    sortOrder: number;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "🏪");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    await onSubmit({
      label: label.trim(),
      description: description.trim(),
      icon: icon.trim() || "🏪",
      sortOrder: Number(sortOrder) || 0,
    });
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-sm font-medium text-zinc-200">
        {initial ? "Edit category" : "New category"}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[5rem_1fr_6rem]">
        <label className="block text-xs text-zinc-400">
          Icon
          <input className={`${input} mt-1`} value={icon} onChange={(e) => setIcon(e.target.value)} />
        </label>
        <label className="block text-xs text-zinc-400">
          Label
          <input
            className={`${input} mt-1`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Sports & turf"
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Sort
          <input
            className={`${input} mt-1`}
            inputMode="numeric"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value.replace(/[^\d-]/g, ""))}
          />
        </label>
      </div>
      <label className="mt-3 block text-xs text-zinc-400">
        Description
        <input
          className={`${input} mt-1`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short helper text shown to vendors"
        />
      </label>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full border border-white/10 py-2 text-sm text-zinc-300 hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !label.trim()}
          className="btn-primary flex-1 rounded-full py-2 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Saving…" : initial ? "Save" : "Create"}
        </button>
      </div>
    </form>
  );
}

function TypeForm({
  categoryId,
  moduleOptions,
  initial,
  onSubmit,
  onCancel,
}: {
  categoryId: string;
  moduleOptions: { id: string; label: string }[];
  initial?: AdminCatalogType;
  onSubmit: (body: {
    categoryId: string;
    label: string;
    module: BusinessModule;
    description: string;
    examples: string;
    namePlaceholder: string;
    detailHint: string;
    sortOrder: number;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [moduleId, setModuleId] = useState(initial?.module ?? moduleOptions[0]?.id ?? "appointments");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [examples, setExamples] = useState(initial?.examples ?? "");
  const [namePlaceholder, setNamePlaceholder] = useState(initial?.namePlaceholder ?? "");
  const [detailHint, setDetailHint] = useState(initial?.detailHint ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    await onSubmit({
      categoryId,
      label: label.trim(),
      module: moduleId as BusinessModule,
      description: description.trim(),
      examples: examples.trim(),
      namePlaceholder: namePlaceholder.trim(),
      detailHint: detailHint.trim(),
      sortOrder: Number(sortOrder) || 0,
    });
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-sm font-medium text-zinc-200">{initial ? "Edit type" : "New type"}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-zinc-400">
          Label
          <input
            className={`${input} mt-1`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Salon"
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Module
          <select
            className={`${input} mt-1`}
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
          >
            {moduleOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-zinc-400">
          Examples
          <input
            className={`${input} mt-1`}
            value={examples}
            onChange={(e) => setExamples(e.target.value)}
            placeholder="Hair, spa, nails"
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Sort order
          <input
            className={`${input} mt-1`}
            inputMode="numeric"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value.replace(/[^\d-]/g, ""))}
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Name placeholder
          <input
            className={`${input} mt-1`}
            value={namePlaceholder}
            onChange={(e) => setNamePlaceholder(e.target.value)}
            placeholder="e.g. Glow Salon"
          />
        </label>
        <label className="block text-xs text-zinc-400">
          Detail hint
          <input
            className={`${input} mt-1`}
            value={detailHint}
            onChange={(e) => setDetailHint(e.target.value)}
            placeholder="Shown under the name field"
          />
        </label>
      </div>
      <label className="mt-3 block text-xs text-zinc-400">
        Description
        <input
          className={`${input} mt-1`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full border border-white/10 py-2 text-sm text-zinc-300 hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !label.trim()}
          className="btn-primary flex-1 rounded-full py-2 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Saving…" : initial ? "Save" : "Create"}
        </button>
      </div>
    </form>
  );
}
