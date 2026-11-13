"use client";

import { Switch } from "@/components/ui";
import { OWNER_ONLY, togglePermission, type PermissionInfo, type TeamPermission } from "@/lib/api/team";
import styles from "./team.module.css";

/** The owner picks what one person may do. Turning on something that needs "See orders" turns that on too. Same as the app. */
export function PermissionPicker({
  catalog,
  value,
  onChange,
  disabled,
}: {
  catalog: PermissionInfo[];
  value: TeamPermission[];
  onChange: (next: TeamPermission[]) => void;
  disabled?: boolean;
}) {
  const label = (key: TeamPermission) => catalog.find((p) => p.key === key)?.label ?? key;
  return (
    <div className={styles.picker}>
      <div className={styles.switches}>
        {catalog.map((p) => (
          <Switch
            key={p.key}
            checked={value.includes(p.key)}
            disabled={disabled}
            onChange={(on) => onChange(togglePermission(catalog, value, p.key, on))}
            description={[p.hint, p.needs ? `Comes with "${label(p.needs)}"` : null].filter(Boolean).join(". ") || undefined}
          >
            {p.label}
          </Switch>
        ))}
      </div>
      <p className={styles.muted}>{OWNER_ONLY}</p>
    </div>
  );
}
