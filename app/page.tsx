import Link from "next/link";
import { Particles } from "@/components/particles";
import { Globe } from "@/components/globe";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0" />
        <div className="spotlight absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black to-transparent" />
      </div>

      {/* full-hero particle field */}
      <Particles />

      {/* nav */}
      <header className="reveal relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight">Ruxstar</span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="glass rounded-full px-5 py-2 text-sm font-medium transition hover:bg-white/10"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="glass rounded-full px-5 py-2 text-sm font-medium transition hover:bg-white/10"
          >
            Sign up
          </Link>
        </div>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-5.5rem)] max-w-6xl items-center gap-12 px-6 pb-16 lg:grid-cols-2">
        <div className="text-center lg:text-left">
          <h1
            className="reveal text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ animationDelay: "0.15s" }}
          >
            <span className="text-gradient">Powering Businesses.</span>
            <br />
            Connecting People.
          </h1>

          <p
            className="reveal mx-auto mt-6 max-w-xl text-pretty text-base text-zinc-400 lg:mx-0 lg:text-lg"
            style={{ animationDelay: "0.25s" }}
          >
            Manage businesses, employees, customers, orders, and deliveries from
            one intelligent platform.
          </p>

          <div
            className="reveal mt-9 flex flex-col items-center lg:items-start"
            style={{ animationDelay: "0.35s" }}
          >
            <Link
              href="/login"
              className="btn-primary group inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition sm:w-auto"
            >
              Enter Platform
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </div>

        {/* connected globe */}
        <div
          className="reveal"
          style={{ animationDelay: "0.3s" }}
          aria-label="A globe of businesses connected together through Ruxstar"
        >
          <Globe />
        </div>
      </section>
    </div>
  );
}
