"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.replace("/login"), 2500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="splash-screen flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="animate-fade-in flex flex-col items-center">
        <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">
          Ruxstar
        </h1>
        <p className="mt-4 text-sm tracking-[0.2em] text-white/60 uppercase">
          One Platform. Every Business.
        </p>
        <div className="mt-10 h-0.5 w-32 overflow-hidden rounded-full bg-white/10">
          <div className="splash-loader h-full rounded-full bg-teal-400/80" />
        </div>
      </div>
    </main>
  );
}
