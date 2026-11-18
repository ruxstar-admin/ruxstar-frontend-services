"use client";

import { useId, useRef } from "react";
import { Icon, Input } from "@/components/ui";
import { TextArea } from "@/components/vendor/parts";
import type { GigCategoryOption, GigPhoto } from "@/lib/api/gigs";
import { categoryLabel, type ProfileDraft } from "@/lib/gigs";
import vendor from "@/components/vendor/vendor.module.css";

/** A select over keyed options; a saved key that's since hidden still shows by its name. */
export function KeyedSelect({
  label,
  value,
  options,
  onChange,
  error,
}: {
  label: string;
  value: string;
  options: readonly GigCategoryOption[];
  onChange: (key: string) => void;
  error?: string;
}) {
  const id = useId();
  const shown = value && !options.some((o) => o.key === value) ? [...options, { key: value, label: categoryLabel(options, value) }] : options;
  return (
    <div className={vendor.field}>
      <label htmlFor={id} className={vendor.label}>
        {label}
      </label>
      <select
        id={id}
        className={vendor.select}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Pick one
        </option>
        {shown.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className={vendor.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** The freelancer profile's fields, for starting out and for editing. Errors show once `errors` has them. */
export function ProfileFields({
  draft,
  set,
  errors,
  categories,
}: {
  draft: ProfileDraft;
  set: <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => void;
  errors: Record<string, string | undefined>;
  categories: readonly GigCategoryOption[];
}) {
  return (
    <>
      <Input label="Name customers see" value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={60} error={errors.name} />
      <Input
        label="Headline"
        value={draft.headline}
        onChange={(e) => set("headline", e.target.value)}
        maxLength={80}
        placeholder="Like “Logo designer for small brands”"
        error={errors.headline}
      />
      <KeyedSelect label="What you do" value={draft.category} options={categories} onChange={(v) => set("category", v)} error={errors.category} />
      <TextArea
        label="About you (optional)"
        value={draft.bio}
        onChange={(v) => set("bio", v)}
        max={500}
        placeholder="Your experience, the kind of work you love, how you work"
        error={errors.bio}
      />
      <Input
        label="Skills (optional)"
        value={draft.skills}
        onChange={(e) => set("skills", e.target.value)}
        placeholder="Logo design, Illustrator, branding"
        hint="Separate them with commas."
        error={errors.skills}
      />
      <Input
        label="Languages"
        value={draft.languages}
        onChange={(e) => set("languages", e.target.value)}
        placeholder="English, Hindi"
        hint="Separate them with commas."
        error={errors.languages}
      />
      <Input label="City (optional)" value={draft.city} onChange={(e) => set("city", e.target.value)} maxLength={60} placeholder="Where you are" error={errors.city} />
    </>
  );
}

/** Photos in a grid with a cross on each and an add tile while there's room. `cover` marks the first as the cover; `room` null hides adding and removing. */
export function PhotoGrid({
  photos,
  room,
  busy,
  cover,
  onAdd,
  onRemove,
}: {
  photos: readonly GigPhoto[];
  room: boolean | null;
  busy: boolean;
  cover?: boolean;
  onAdd: (file: File) => void;
  onRemove: (photo: GigPhoto) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <ul className={vendor.photos} aria-label="Photos">
      {photos.map((photo, i) => (
        <li key={photo.id} className={vendor.photo}>
          <img src={photo.url} width={photo.width} height={photo.height} alt={cover && i === 0 ? "Cover photo" : `Photo ${i + 1}`} loading="lazy" decoding="async" />
          {cover && i === 0 && <span className={vendor.coverTag}>Cover</span>}
          {room !== null && (
            <button type="button" className={vendor.photoRemove} aria-label={`Remove photo ${i + 1}`} disabled={busy} onClick={() => onRemove(photo)}>
              <Icon name="close" size={16} />
            </button>
          )}
        </li>
      ))}
      {room && (
        <li>
          <button type="button" className={vendor.addPhoto} aria-label={busy ? "Uploading" : "Add a photo"} disabled={busy} onClick={() => file.current?.click()}>
            <Icon name={busy ? "clock" : "camera"} size={28} />
          </button>
          <input
            ref={file}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const picked = e.target.files?.[0];
              e.target.value = "";
              if (picked) onAdd(picked);
            }}
          />
        </li>
      )}
    </ul>
  );
}
