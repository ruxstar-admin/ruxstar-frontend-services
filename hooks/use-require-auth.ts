"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type AuthUser,
  AuthError,
  clearSession,
  getUserRole,
  homeForUser,
  isStaffUser,
  refreshSession,
} from "@/lib/api";

export type RequireAuthOptions = {
  /** Allowed roles (lowercase). User is redirected to their home route if not listed. */
  roles?: string[];
  /** Admin or employee only. */
  staff?: boolean;
  /** Where to send users with no valid session. */
  loginPath?: string;
};

export function useRequireAuth(options: RequireAuthOptions = {}) {
  const router = useRouter();
  const { staff, roles, loginPath = "/login" } = options;
  const rolesKey = roles?.join(",") ?? "";

  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    refreshSession()
      .then((freshUser) => {
        if (cancelled) return;

        if (staff && !isStaffUser(freshUser)) {
          router.replace(homeForUser(freshUser));
          return;
        }

        if (rolesKey) {
          const allowed = rolesKey.split(",");
          const role = getUserRole(freshUser);
          if (!allowed.includes(role)) {
            router.replace(homeForUser(freshUser));
            return;
          }
        }

        setUser(freshUser);
        setReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof AuthError) {
          clearSession();
          router.replace(loginPath);
          return;
        }
        router.replace(loginPath);
      });

    return () => {
      cancelled = true;
    };
  }, [router, staff, rolesKey, loginPath]);

  return { user, ready };
}
