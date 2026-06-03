"use client";

import { useRouter } from "next/navigation";
import { logout } from "@/lib/api";

export function LogoutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        await logout();
        router.push("/");
      }}
      className="glass rounded-full px-5 py-2 text-sm font-medium transition hover:bg-white/10"
    >
      Log out
    </button>
  );
}
