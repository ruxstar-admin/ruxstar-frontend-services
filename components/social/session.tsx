"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe, isSignedOut, type User } from "@/lib/api/account";

/** `undefined` while checking, `null` when signed out. */
type Me = User | null | undefined;

const SessionContext = createContext<Me>(undefined);
const SetSessionContext = createContext<(user: User) => void>(() => undefined);

export const useMe = () => useContext(SessionContext);
/** For screens that change the profile, so the header shows the new name and photo at once. */
export const useSetMe = () => useContext(SetSessionContext);

/**
 * One `/me` call per visit, shared by the header and every post. It lives in the signed-in layout,
 * so moving between its pages keeps it.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me>(undefined);

  useEffect(() => {
    let live = true;
    getMe()
      .then((user) => live && setMe(user))
      .catch(() => live && setMe(null));
    return () => {
      live = false;
    };
  }, []);

  return (
    <SetSessionContext.Provider value={setMe}>
      <SessionContext.Provider value={me}>{children}</SessionContext.Provider>
    </SetSessionContext.Provider>
  );
}

/** Sends people to sign in and back to this page; for actions that need an account. */
export function useSignInFirst() {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(() => router.push(`/signin?next=${encodeURIComponent(pathname)}`), [router, pathname]);
}

/** For signed-in pages: when a call fails because the session ended, go to sign in. */
export function useOnSignedOut() {
  const signIn = useSignInFirst();
  return useCallback(
    (err: unknown) => {
      if (!isSignedOut(err)) return false;
      signIn();
      return true;
    },
    [signIn],
  );
}
