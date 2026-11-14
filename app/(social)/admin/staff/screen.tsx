"use client";

import { useEffect, useRef, useState } from "react";
import { Needs, useAccess } from "@/components/admin/AdminFrame";
import { Failed, Rows, styles } from "@/components/admin/parts";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { Button, Card, Icon, Input, Switch, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { findUsers, listStaff, removeStaff, saveStaff, type Permission, type StaffMember, type UserRow } from "@/lib/api/admin";
import { ago } from "@/lib/time";

const AREA: Record<string, string> = {
  kyc: "Verification",
  reports: "Reported posts",
  users: "People",
  modules: "Modules",
  businesses: "Businesses",
  orders: "Print orders",
  support: "Help tickets",
  audit: "Audit log",
};

/** A title plus the permissions it carries, grouped by section. */
function Grant({
  title: startTitle,
  permissions: startPermissions,
  confirm,
  onCancel,
  onSave,
}: {
  title: string;
  permissions: Permission[];
  confirm: string;
  onCancel: () => void;
  onSave: (title: string, permissions: Permission[]) => Promise<void>;
}) {
  const { catalog } = useAccess();
  const [title, setTitle] = useState(startTitle);
  const [picked, setPicked] = useState<Set<Permission>>(new Set(startPermissions));
  const [busy, setBusy] = useState(false);
  const areas = [...new Set(catalog.map((p) => p.key.split(".")[0]!))];

  const toggle = (key: Permission, on: boolean) =>
    setPicked((set) => {
      const next = new Set(set);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const valid = title.trim().length >= 2 && picked.size > 0;

  return (
    <div className={styles.detail}>
      <Input label="Title" hint="What they do, for example Support lead" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
      {areas.map((area) => (
        <div key={area} className={styles.group}>
          <span className={styles.label}>{AREA[area] ?? area}</span>
          {catalog
            .filter((p) => p.key.startsWith(`${area}.`))
            .map((p) => (
              <Switch key={p.key} checked={picked.has(p.key)} onChange={(on) => toggle(p.key, on)}>
                {p.label}
              </Switch>
            ))}
        </div>
      ))}
      <div className={styles.actions}>
        {picked.size === 0 && <span className={styles.muted}>Pick at least one permission.</span>}
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          disabled={!valid}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(title.trim(), catalog.map((p) => p.key).filter((k) => picked.has(k)));
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirm}
        </Button>
      </div>
    </div>
  );
}

/** Find the person to add. Admins and current staff are left out. */
function AddMember({ staff, onAdded, onCancel }: { staff: StaffMember[]; onAdded: (m: StaffMember) => void; onCancel: () => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [text, setText] = useState("");
  const [results, setResults] = useState<UserRow[] | null>(null);
  const [chosen, setChosen] = useState<UserRow | null>(null);
  const key = useRef(crypto.randomUUID());

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      findUsers(q, "active").then(
        (page) => {
          if (!live) return;
          const current = new Set(staff.filter((m) => m.status === "active").map((m) => m.user.id));
          setResults(page.items.filter((u) => !u.roles.admin && !current.has(u.id)).slice(0, 8));
        },
        (err) => live && !onSignedOut(err) && toast(formError(err).message, "danger"),
      );
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [text, staff, onSignedOut, toast]);

  if (chosen) {
    const before = staff.find((m) => m.user.id === chosen.id);
    return (
      <Card as="section" padding="lg">
        <div className={styles.identity}>
          <Avatar name={chosen.name || chosen.username} url={chosen.avatarUrl} size={44} />
          <span className={styles.whoRow}>
            <span className={styles.name}>{chosen.name || "No name"}</span>
            <span className={styles.muted}>@{chosen.username}</span>
          </span>
        </div>
        <Grant
          title={before?.title ?? ""}
          permissions={before?.permissions ?? []}
          confirm="Add to staff"
          onCancel={() => setChosen(null)}
          onSave={async (title, permissions) => {
            try {
              onAdded(await saveStaff(chosen.id, title, permissions, key.current));
            } catch (err) {
              if (!onSignedOut(err)) toast(formError(err).message, "danger");
            }
          }}
        />
      </Card>
    );
  }

  return (
    <Card as="section" padding="lg" className={styles.page}>
      <div className={styles.groupHead}>
        <h2 className={styles.subtitle}>Add a team member</h2>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <Input
        label="Find their account"
        hint="Phone number, @username or name. They need a Ruxstar account first."
        type="search"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim().length < 2) setResults(null);
        }}
        autoFocus
        autoComplete="off"
      />
      {results &&
        (results.length === 0 ? (
          <p className={styles.muted}>Nobody to add matches that.</p>
        ) : (
          <ul className={styles.list}>
            {results.map((u) => (
              <li key={u.id} className={styles.item}>
                <button type="button" className={styles.row} onClick={() => setChosen(u)}>
                  <Avatar name={u.name || u.username} url={u.avatarUrl} size={40} />
                  <span className={styles.whoRow}>
                    <span className={styles.name}>{u.name || "No name"}</span>
                    <span className={styles.muted}>
                      @{u.username} · {u.phone}
                    </span>
                  </span>
                  <Icon name="plus" size={20} className={styles.chevron} />
                </button>
              </li>
            ))}
          </ul>
        ))}
    </Card>
  );
}

function Member({ m, onChanged }: { m: StaffMember; onChanged: (m: StaffMember, message: string) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const keys = useRef({ save: crypto.randomUUID(), remove: crypto.randomUUID() });
  const active = m.status === "active";

  return (
    <li className={styles.item} data-open={open || undefined}>
      <button type="button" className={styles.row} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Avatar name={m.user.name || m.user.username} url={m.user.avatarUrl} size={44} />
        <span className={styles.whoRow}>
          <span className={styles.name}>{m.user.name || "No name"}</span>
          <span className={`${styles.muted} ${styles.line}`}>
            {m.title} · {m.permissions.length === 1 ? "1 permission" : `${m.permissions.length} permissions`}
          </span>
        </span>
        {!active && <Tag>Removed</Tag>}
        <span className={styles.time}>{active ? `Since ${ago(m.grantedAt)}` : `Removed ${ago(m.updatedAt)}`}</span>
        <Icon name="chevron-down" size={20} className={styles.chevron} />
      </button>
      {open && (
        <>
          <Grant
            title={m.title}
            permissions={m.permissions}
            confirm={active ? "Save changes" : "Bring back"}
            onCancel={() => setOpen(false)}
            onSave={async (title, permissions) => {
              try {
                const done = await saveStaff(m.user.id, title, permissions, keys.current.save);
                keys.current.save = crypto.randomUUID();
                setOpen(false);
                onChanged(done, active ? "Saved." : `${m.user.name || "They"} are back on staff.`);
              } catch (err) {
                if (!onSignedOut(err)) toast(formError(err).message, "danger");
              }
            }}
          />
          {active && (
            <div className={styles.detail}>
              <div className={styles.actions}>
                <span className={styles.muted}>They lose console access at once. Their account stays as it is.</span>
                <Button
                  variant="danger"
                  loading={removing}
                  onClick={async () => {
                    setRemoving(true);
                    try {
                      const done = await removeStaff(m.user.id, keys.current.remove);
                      keys.current.remove = crypto.randomUUID();
                      setOpen(false);
                      onChanged(done, `${m.user.name || "They"} removed from staff.`);
                    } catch (err) {
                      if (!onSignedOut(err)) toast(formError(err).message, "danger");
                    } finally {
                      setRemoving(false);
                    }
                  }}
                >
                  Remove from staff
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </li>
  );
}

export function StaffScreen() {
  return (
    <Needs need="admin">
      <StaffList />
    </Needs>
  );
}

function StaffList() {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let live = true;
    listStaff().then(
      (list) => live && setStaff(list),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [attempt, onSignedOut]);

  const put = (m: StaffMember) =>
    setStaff((list) => {
      const rest = (list ?? []).filter((x) => x.user.id !== m.user.id);
      return m.status === "active" ? [m, ...rest] : [...rest, m];
    });

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Ruxstar staff</h1>
          <p className={styles.muted}>Give team members only the sections they need. Admins have everything and are not listed.</p>
        </div>
        {!adding && staff && (
          <Button onClick={() => setAdding(true)} icon={<Icon name="plus" size={18} />}>
            Add
          </Button>
        )}
      </div>

      {adding && staff && (
        <AddMember
          staff={staff}
          onCancel={() => setAdding(false)}
          onAdded={(m) => {
            put(m);
            setAdding(false);
            toast(`${m.user.name || "They"} added to staff.`, "success");
          }}
        />
      )}

      {error ? (
        <Failed
          error={error}
          onRetry={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        />
      ) : !staff ? (
        <Rows />
      ) : staff.length === 0 ? (
        <p className={styles.empty}>No staff yet. Add someone to share the work.</p>
      ) : (
        <ul className={styles.list}>
          {staff.map((m) => (
            <Member
              key={m.user.id}
              m={m}
              onChanged={(done, message) => {
                put(done);
                toast(message, "success");
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
