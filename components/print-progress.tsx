"use client";

type Role = "customer" | "vendor";

type StepCopy = { title: string; sub: string };

type Step = {
  key: string;
  label: string;
  icon: string;
  customer: StepCopy;
  vendor: StepCopy;
};

const STEPS: Step[] = [
  {
    key: "open",
    label: "Collecting quotes",
    icon: "📝",
    customer: { title: "Order placed!", sub: "Vendors nearby are sending quotes — you pick one." },
    vendor: { title: "New order in", sub: "Send your best quote to win this job." },
  },
  {
    key: "accepted",
    label: "Vendor chosen",
    icon: "🤝",
    customer: { title: "Vendor chosen 🎉", sub: "Pay your chosen quote to confirm." },
    vendor: { title: "You won this order 🎉", sub: "Waiting for the customer to pay." },
  },
  {
    key: "confirmed",
    label: "Payment confirmed",
    icon: "💳",
    customer: { title: "Payment confirmed", sub: "Your vendor is getting started." },
    vendor: { title: "Payment received 💰", sub: "Time to start production." },
  },
  {
    key: "in_production",
    label: "In production",
    icon: "🎨",
    customer: { title: "Being made now", sub: "Your order is on the press." },
    vendor: { title: "In production", sub: "Mark it ready once it’s printed." },
  },
  {
    key: "ready",
    label: "Ready",
    icon: "📦",
    customer: { title: "Ready for you!", sub: "Your vendor will hand it over soon." },
    vendor: { title: "Ready to hand over", sub: "Complete it once the customer has it." },
  },
  {
    key: "completed",
    label: "Completed",
    icon: "🎉",
    customer: { title: "All done!", sub: "Thanks for printing with Ruxstar." },
    vendor: { title: "Order complete 🎉", sub: "Nice work — payment settled." },
  },
];

const STEP_INDEX: Record<string, number> = {
  open: 0,
  accepted: 1,
  pending_payment: 1,
  confirmed: 2,
  in_production: 3,
  ready: 4,
  completed: 5,
};

const CONFETTI = ["#34d399", "#fbbf24", "#f472b6", "#60a5fa", "#f87171", "#a78bfa"];

export function PrintProgress({
  status,
  role,
  size = "md",
  className = "",
}: {
  status: string;
  role: Role;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const lg = size === "lg";
  const sm = size === "sm";
  const cancelled = status === "cancelled" || status === "expired";

  if (cancelled) {
    return (
      <div
        className={`overflow-hidden rounded-2xl border border-red-400/20 bg-red-400/[0.04] ${
          sm ? "p-4" : "p-6"
        } ${className}`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`grid shrink-0 place-items-center rounded-full border border-red-400/25 bg-red-400/10 ${
              sm ? "h-11 w-11 text-2xl" : "h-16 w-16 text-3xl"
            }`}
          >
            🚫
          </span>
          <div>
            <p className={`font-semibold text-red-100 ${sm ? "text-base" : "text-lg"}`}>
              Order {status === "expired" ? "expired" : "cancelled"}
            </p>
            <p className="mt-0.5 text-sm text-red-200/70">
              {status === "expired"
                ? "No vendor accepted this order in time."
                : "This order is no longer active."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const step = STEP_INDEX[status] ?? 0;
  const active = STEPS[step];
  const copy = role === "vendor" ? active.vendor : active.customer;
  const isDone = step >= STEPS.length - 1;
  const pct = (step / (STEPS.length - 1)) * 100;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-b from-white/[0.05] to-white/[0.01] ${
        lg ? "p-6 sm:p-10" : sm ? "p-4 sm:p-5" : "p-5 sm:p-6"
      } ${className}`}
    >
      {/* Hero */}
      <div
        className={`flex items-center ${
          lg ? "gap-5 sm:gap-7" : sm ? "gap-3 sm:gap-4" : "gap-4 sm:gap-5"
        }`}
      >
        <div className="relative shrink-0">
          <span
            className={`relative grid place-items-center rounded-full border ${
              lg
                ? "h-20 w-20 text-5xl sm:h-28 sm:w-28 sm:text-6xl"
                : sm
                  ? "h-12 w-12 text-2xl sm:h-14 sm:w-14 sm:text-3xl"
                  : "h-16 w-16 text-4xl sm:h-20 sm:w-20 sm:text-5xl"
            } ${
              isDone
                ? "border-emerald-400/40 bg-emerald-400/15"
                : "border-white/12 bg-white/[0.06]"
            }`}
          >
            <span key={active.key} className="prog-mascot inline-block">
              {active.icon}
            </span>
          </span>
          {isDone && (
            <div className="prog-confetti pointer-events-none absolute -inset-2">
              {CONFETTI.map((c, i) => (
                <span
                  key={i}
                  style={{
                    left: `${8 + i * 15}%`,
                    background: c,
                    animationDelay: `${i * 0.18}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-300/80">
            Step {step + 1} of {STEPS.length}
          </p>
          <h3
            className={`mt-0.5 font-semibold text-zinc-100 ${
              lg ? "text-2xl sm:text-3xl" : sm ? "text-base sm:text-lg" : "text-lg sm:text-xl"
            }`}
          >
            {copy.title}
          </h3>
          <p
            className={`mt-0.5 text-zinc-400 ${
              lg ? "text-base sm:text-lg" : sm ? "text-xs sm:text-sm" : "text-sm"
            }`}
          >
            {copy.sub}
          </p>

          <div
            className={`mt-3 w-full overflow-hidden rounded-full bg-white/8 ${
              lg ? "h-2.5" : sm ? "h-1.5" : "h-2"
            }`}
          >
            <div
              className="prog-fill relative h-full rounded-full"
              style={{ width: `${Math.max(pct, 6)}%` }}
            >
              {!isDone && <span className="prog-fill-shimmer absolute inset-0" />}
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal rail (sm+) */}
      <div
        className={`relative hidden sm:block ${lg ? "mt-12" : sm ? "mt-6" : "mt-8"}`}
      >
        <div
          className={`absolute left-0 right-0 rounded-full bg-white/8 ${
            lg ? "top-7 h-1.5" : sm ? "top-4 h-1" : "top-5 h-1"
          }`}
        />
        <div
          className={`prog-fill absolute left-0 rounded-full ${
            lg ? "top-7 h-1.5" : sm ? "top-4 h-1" : "top-5 h-1"
          }`}
          style={{ width: `${pct}%` }}
        />
        <ol className="relative flex justify-between">
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li
                key={s.key}
                className={`flex flex-col items-center text-center ${
                  lg ? "w-24" : sm ? "w-14" : "w-16"
                }`}
              >
                <span
                  className={`grid place-items-center rounded-full border transition ${
                    lg ? "h-14 w-14 text-2xl" : sm ? "h-8 w-8 text-sm" : "h-10 w-10 text-lg"
                  } ${
                    done
                      ? "prog-node-pop border-emerald-400/40 bg-emerald-400/20"
                      : current
                        ? "prog-wiggle border-emerald-300/60 bg-emerald-400/10"
                        : "border-white/10 bg-white/[0.03] opacity-50 grayscale"
                  }`}
                >
                  {done ? "✓" : s.icon}
                </span>
                <span
                  className={`leading-tight ${
                    lg ? "mt-3 text-sm" : sm ? "mt-1.5 text-[10px]" : "mt-2 text-[11px]"
                  } ${
                    current
                      ? "font-medium text-zinc-100"
                      : done
                        ? "text-zinc-400"
                        : "text-zinc-600"
                  }`}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Vertical rail (mobile) */}
      <ol className="relative mt-6 space-y-1 sm:hidden">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          const last = i === STEPS.length - 1;
          return (
            <li key={s.key} className="relative flex gap-3 pb-3">
              {!last && (
                <span
                  className={`absolute left-[19px] top-10 h-full w-0.5 ${
                    done ? "bg-emerald-400/50" : "bg-white/8"
                  }`}
                />
              )}
              <span
                className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border text-lg ${
                  done
                    ? "prog-node-pop border-emerald-400/40 bg-emerald-400/20"
                    : current
                      ? "prog-wiggle border-emerald-300/60 bg-emerald-400/10"
                      : "border-white/10 bg-white/[0.03] opacity-50 grayscale"
                }`}
              >
                {done ? "✓" : s.icon}
              </span>
              <div className="pt-1.5">
                <p
                  className={`text-sm ${
                    current
                      ? "font-medium text-zinc-100"
                      : done
                        ? "text-zinc-400"
                        : "text-zinc-600"
                  }`}
                >
                  {s.label}
                </p>
                {current && (
                  <p className="mt-0.5 text-xs text-zinc-500">{copy.sub}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
