"use client";

import { SWRConfig } from "swr";

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        refreshWhenHidden: false,
        focusThrottleInterval: 60_000,
        dedupingInterval: 10_000,
        errorRetryCount: 2,
      }}
    >
      {children}
    </SWRConfig>
  );
}
