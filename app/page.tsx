"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/button";

type ApiResponseState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; body: string }
  | { status: "error"; message: string };

const ENDPOINTS = {
  backend: { url: "/api/backend", label: "backend" },
  health: { url: "/api/health", label: "health" },
} as const;

type EndpointKey = keyof typeof ENDPOINTS;

async function formatResponseBody(response: Response): Promise<string> {
  const text = await response.text();

  if (!text) {
    return `HTTP ${response.status} ${response.statusText}`;
  }

  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function StatusBadge({ state }: { state: ApiResponseState }) {
  if (state.status === "loading") {
    return (
      <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">
        Loading
      </span>
    );
  }

  if (state.status === "success") {
    return (
      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
        Success
      </span>
    );
  }

  if (state.status === "error") {
    return (
      <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400 ring-1 ring-red-500/20">
        Error
      </span>
    );
  }

  return null;
}

function TerminalContent({
  state,
  endpoint,
}: {
  state: ApiResponseState;
  endpoint: string;
}) {
  if (state.status === "loading") {
    return (
      <p className="font-mono text-sm text-zinc-500">
        <span className="text-indigo-400">$</span> fetch {endpoint}...
        <span className="inline-block w-2 animate-pulse">▋</span>
      </p>
    );
  }

  if (state.status === "success") {
    return (
      <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-emerald-300/90">
        {state.body}
      </pre>
    );
  }

  if (state.status === "error") {
    return (
      <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-red-300/90">
        {state.message}
      </pre>
    );
  }

  return null;
}

function ResponseCard({
  state,
  endpoint = "response",
}: {
  state: ApiResponseState;
  endpoint?: string;
}) {
  if (state.status === "idle") {
    return null;
  }

  return (
    <div
      className="animate-fade-in w-full max-w-2xl"
      role="region"
      aria-live="polite"
      aria-label="API response"
    >
      <div
        className={[
          "overflow-hidden rounded-2xl border border-white/[0.08]",
          "bg-panel/90 shadow-2xl backdrop-blur-xl",
          "ring-1 ring-white/[0.04]",
        ].join(" ")}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
            <span className="ml-2 font-mono text-xs text-zinc-500">
              ruxstar — {endpoint}
            </span>
          </div>
          <StatusBadge state={state} />
        </div>
        <div className="min-h-[4.5rem] max-h-80 overflow-y-auto p-4 text-left sm:p-5">
          <TerminalContent state={state} endpoint={endpoint} />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [apiState, setApiState] = useState<ApiResponseState>({ status: "idle" });
  const [activeEndpoint, setActiveEndpoint] = useState("response");

  const callEndpoint = useCallback(async (key: EndpointKey) => {
    const { url, label } = ENDPOINTS[key];
    setActiveEndpoint(label);
    setApiState({ status: "loading" });

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const body = await formatResponseBody(response);

      if (!response.ok) {
        setApiState({
          status: "error",
          message: `HTTP ${response.status} ${response.statusText}\n\n${body}`,
        });
        return;
      }

      setApiState({ status: "success", body });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while calling the backend.";

      setApiState({ status: "error", message });
    }
  }, []);

  const isLoading = apiState.status === "loading";

  return (
    <main className="flex min-h-screen flex-col items-center px-4 pb-20 pt-[10vh] sm:px-6 sm:pt-[12vh]">
      <div className="flex w-full max-w-2xl flex-col items-center gap-10 text-center">
        <header className="flex flex-col items-center gap-4">
          <div
            className="mb-2 h-px w-16 bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent"
            aria-hidden="true"
          />
          <h1 className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
            Ruxstar
          </h1>
          <p className="text-sm font-medium tracking-widest text-zinc-500 uppercase">
            Backend Connectivity Demo
          </p>
        </header>

        <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Button
            isLoading={isLoading && activeEndpoint === "backend"}
            disabled={isLoading}
            onClick={() => callEndpoint("backend")}
          >
            {isLoading && activeEndpoint === "backend"
              ? "Calling…"
              : "Call Backend"}
          </Button>
          <Button
            variant="secondary"
            isLoading={isLoading && activeEndpoint === "health"}
            disabled={isLoading}
            onClick={() => callEndpoint("health")}
          >
            {isLoading && activeEndpoint === "health"
              ? "Checking…"
              : "Health Check"}
          </Button>
        </div>

        <ResponseCard state={apiState} endpoint={activeEndpoint} />
      </div>
    </main>
  );
}
