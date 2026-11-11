"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";
import "./tokens.css";
import "./globals.css";

/** Only when the root layout itself fails, so it brings its own document and styles. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main
          role="alert"
          style={{ display: "grid", justifyItems: "center", alignContent: "center", gap: 16, minHeight: "100dvh", padding: 24, textAlign: "center" }}
        >
          <h1 className="t-headline">Ruxstar did not load</h1>
          <p style={{ color: "var(--ink-2)" }}>Check your connection, then try again.</p>
          <Button onClick={reset}>Try again</Button>
        </main>
      </body>
    </html>
  );
}
