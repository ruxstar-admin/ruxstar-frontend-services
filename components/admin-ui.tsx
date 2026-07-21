"use client";

import type { ReactNode } from "react";

export function AdminHeader({
  title,
  subtitle,
  total,
}: {
  title: string;
  subtitle?: string;
  total?: number;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-widest text-zinc-500">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
          <span className="text-gradient">{title}</span>
        </h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {typeof total === "number" && (
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
          {total.toLocaleString("en-IN")} total
        </span>
      )}
    </div>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">⌕</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field-input h-9 w-full py-0 pl-8 text-sm text-zinc-100"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 text-sm text-zinc-500 hover:text-zinc-200"
          aria-label="Clear"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className="field-input h-9 w-full py-0 text-sm text-zinc-100 sm:w-44"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const TONES: Record<string, string> = {
  green: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  amber: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  red: "border-red-400/25 bg-red-400/10 text-red-300",
  violet: "border-violet-400/25 bg-violet-400/10 text-violet-300",
  sky: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  zinc: "border-white/10 bg-white/[0.03] text-zinc-300",
};

export function Pill({ label, tone = "zinc" }: { label: string; tone?: keyof typeof TONES }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${TONES[tone] ?? TONES.zinc}`}
    >
      {label}
    </span>
  );
}

export function Pager({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-zinc-400">
      <span>
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40 hover:bg-white/5"
        >
          Prev
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40 hover:bg-white/5"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function EmptyState({ text, icon = "📭" }: { text: string; icon?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-10 text-center">
      <p className="text-3xl">{icon}</p>
      <p className="mt-3 text-sm text-zinc-400">{text}</p>
    </div>
  );
}

export function LoadingRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
      ))}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 flex flex-col gap-3 border-b border-white/5 pb-4 sm:flex-row sm:items-center">
      {children}
    </div>
  );
}

// Small debounce hook shared by list pages so typing doesn't hammer the API.
export { default as useDebounced } from "@/hooks/use-debounced";
