"use client";

import { useEffect } from "react";

/**
 * The home page's only script. Each `[data-reveal]` rises in once as it enters the screen (one observer for the page), and
 * the businesses preview follows the row under the pointer or keyboard focus. Without it everything simply shows.
 */
export function HomeEffects() {
  useEffect(() => {
    const root = document.documentElement;
    let observer: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            (entry.target as HTMLElement).dataset.shown = "";
            observer?.unobserve(entry.target);
          }
        },
        { rootMargin: "0px 0px -8% 0px" },
      );
      root.dataset.reveal = "";
      document.querySelectorAll("[data-reveal]").forEach((el) => observer?.observe(el));
    }

    const picker = document.querySelector<HTMLElement>("[data-picker]");
    const pick = (event: Event) => {
      const key = (event.target as Element | null)?.closest<HTMLElement>("[data-pick]")?.dataset.pick;
      if (!key || !picker) return;
      picker.querySelectorAll<HTMLElement>("[data-pick]").forEach((row) => row.toggleAttribute("data-on", row.dataset.pick === key));
      picker.querySelectorAll<HTMLElement>("[data-shot]").forEach((shot) => shot.toggleAttribute("data-on", shot.dataset.shot === key));
    };
    picker?.addEventListener("pointerover", pick);
    picker?.addEventListener("focusin", pick);

    return () => {
      observer?.disconnect();
      delete root.dataset.reveal;
      picker?.removeEventListener("pointerover", pick);
      picker?.removeEventListener("focusin", pick);
    };
  }, []);

  return null;
}
