"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { formError, isSignedOut, removePhoto, setPhoto, type User } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { shrinkPhoto } from "@/lib/photo";
import { Avatar } from "./Avatar";
import styles from "./PhotoPicker.module.css";

const PHOTO_ERRORS: Partial<Record<string, string>> = {
  PHOTO_INVALID: "That photo could not be used. Try a different one.",
  PAYLOAD_TOO_LARGE: "That photo is too large. Try a different one.",
  RATE_LIMITED: "You have changed your photo a lot. Try again later.",
};

/** Choose, upload and remove the profile photo. It saves straight away, apart from any form around it. */
export function PhotoPicker({
  name,
  url,
  size = 64,
  layout = "row",
  onChange,
  onSignedOut,
}: {
  name: string;
  url: string | null;
  size?: number;
  layout?: "row" | "stack";
  onChange: (user: User) => void;
  onSignedOut: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const fail = (err: unknown, fallback: string) => {
    if (isSignedOut(err)) return onSignedOut();
    setError(err instanceof ApiError ? (PHOTO_ERRORS[err.code] ?? formError(err).message) : fallback);
  };

  async function upload(file: File) {
    setError(null);
    let photo: Blob;
    try {
      photo = await shrinkPhoto(file);
    } catch {
      return setError("That file is not a photo we can read. Choose a JPEG or PNG.");
    }
    setPreview(URL.createObjectURL(photo));
    setBusy(true);
    try {
      onChange(await setPhoto(photo));
    } catch (err) {
      fail(err, "Could not save your photo. Try again.");
    } finally {
      setPreview(null);
      setBusy(false);
    }
  }

  async function remove() {
    setError(null);
    setBusy(true);
    try {
      onChange(await removePhoto());
    } catch (err) {
      fail(err, "Could not remove your photo. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={layout === "stack" ? styles.stack : styles.row}>
      <Avatar name={name} url={preview ?? url} size={size} busy={busy} />
      <div className={styles.side}>
        <div className={styles.actions}>
          <Button variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
            {url ? "Change photo" : "Choose photo"}
          </Button>
          {url && (
            <button type="button" className={styles.remove} disabled={busy} onClick={() => void remove()}>
              Remove
            </button>
          )}
        </div>
        <p className={error ? styles.error : styles.note} role={error ? "alert" : undefined}>
          {error ?? "Anyone can see your photo. JPEG, PNG or WebP."}
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
