"use client";

import dynamic from "next/dynamic";

export const Particles = dynamic(
  () => import("@/components/particles").then((m) => ({ default: m.Particles })),
  { ssr: false },
);
