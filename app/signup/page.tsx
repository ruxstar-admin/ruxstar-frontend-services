"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Particles } from "@/components/particles";
import { SignupMascot } from "@/components/signup-mascot";
import { homeForUser, postAuth, saveSession } from "@/lib/api";

const input =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none transition focus:border-white/30 focus:bg-white/[0.07]";
const titles = ["Create account", "Verify mobile", "Your details"];
const roles = [
  { id: "customer", label: "Customer", emoji: "🛍️" },
  { id: "vendor", label: "Vendor", emoji: "🏪" },
  { id: "delivery", label: "Delivery", emoji: "🛵" },
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("customer");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  function clearError() {
    if (error) setError("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (step === 0) {
        if (mobile.length !== 10) throw new Error("Enter a 10-digit mobile number.");
        const res = await postAuth("signup/send-otp", { mobile });
        if (res.otp) setDevOtp(res.otp);
        setStep(1);
      } else if (step === 1) {
        if (!otp) throw new Error("Enter the OTP.");
        const res = await postAuth("signup/verify-otp", { mobile, otp });
        setSignupToken(res.signupToken);
        setStep(2);
      } else {
        if (!name.trim()) throw new Error("Enter your name.");
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        const res = await postAuth("signup/complete", {
          signupToken,
          name: name.trim(),
          password,
          role,
        });
        saveSession(res.token, res.user);
        router.push(homeForUser(res.user, role));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      triggerShake();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0" />
        <div className="spotlight absolute inset-0" />
        <div className="grade-overlay absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black to-transparent" />
      </div>

      <Particles />

      <header className="reveal relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Ruxstar
        </Link>
        <Link
          href="/login"
          className="glass rounded-full px-5 py-2 text-sm font-medium transition hover:bg-white/10"
        >
          Log in
        </Link>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-5.5rem)] max-w-6xl items-center gap-10 px-6 pb-16 lg:grid-cols-2 lg:gap-16">
        <div className="reveal order-2 lg:order-1" style={{ animationDelay: "0.1s" }}>
          <SignupMascot
            step={step}
            role={role}
            loading={loading}
            shake={shake}
            error={error}
          />
        </div>

        <div className="reveal order-1 lg:order-2" style={{ animationDelay: "0.2s" }}>
          <div
            className={`glass rounded-2xl p-6 sm:p-8 ${step === 2 ? "lg:p-7" : "lg:p-10"}`}
          >
            <p className="text-xs uppercase tracking-widest text-zinc-500">
              Step {step + 1} of 3
            </p>
            <h1
              className={`mt-1.5 font-semibold ${step === 2 ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"}`}
            >
              <span className="text-gradient">{titles[step]}</span>
            </h1>

            <form onSubmit={onSubmit} className={step === 2 ? "mt-5" : "mt-8"}>
              <div
                key={step}
                className={`signup-step-panel ${step === 2 ? "space-y-3" : "space-y-4"}`}
              >
                {step === 0 && (
                  <label className="block text-sm text-zinc-400">
                    Mobile (+91)
                    <input
                      className={`${input} mt-2`}
                      inputMode="numeric"
                      autoFocus
                      placeholder="9876543210"
                      value={mobile}
                      onChange={(e) => {
                        clearError();
                        setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
                      }}
                    />
                  </label>
                )}

                {step === 1 && (
                  <>
                    {devOtp && (
                      <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
                        Dev OTP: <span className="font-mono font-semibold">{devOtp}</span>
                      </p>
                    )}
                    <label className="block text-sm text-zinc-400">
                      OTP for +91 {mobile}
                      <input
                        className={`${input} mt-2 tracking-[0.35em]`}
                        inputMode="numeric"
                        autoFocus
                        placeholder="••••••"
                        value={otp}
                        onChange={(e) => {
                          clearError();
                          setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                        }}
                      />
                    </label>
                  </>
                )}

                {step === 2 && (
                  <>
                    <label className="block text-sm text-zinc-400">
                      Name
                      <input
                        className={`${input} mt-2`}
                        autoFocus
                        placeholder="What should we call you?"
                        value={name}
                        onChange={(e) => {
                          clearError();
                          setName(e.target.value);
                        }}
                      />
                    </label>

                    <div>
                      <p className="text-sm text-zinc-400">Pick your role</p>
                      <div className="mt-1.5 grid grid-cols-3 gap-3">
                        {roles.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setRole(r.id)}
                            className={`signup-role-chip glass rounded-lg px-1.5 py-2 text-center text-xs ${
                              role === r.id ? "signup-role-chip-active" : ""
                            }`}
                          >
                            <span className="text-base leading-none">{r.emoji}</span>
                            <span className="mt-0.5 block font-medium">{r.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="block text-sm text-zinc-400">
                      Password
                      <div className="relative mt-2">
                        <input
                          type={showPassword ? "text" : "password"}
                          className={`${input} pr-11`}
                          placeholder="At least 8 characters"
                          value={password}
                          onChange={(e) => {
                            clearError();
                            setPassword(e.target.value);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 transition hover:text-zinc-200"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </label>
                  </>
                )}
              </div>

              <div className={`flex gap-3 ${step === 2 ? "mt-4" : "mt-6"}`}>
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setStep(step - 1);
                      setError("");
                    }}
                    className={`flex-1 rounded-full border border-white/10 text-sm transition hover:bg-white/5 ${step === 2 ? "py-2.5" : "py-3"}`}
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className={`btn-primary flex-1 rounded-full text-sm font-semibold transition disabled:opacity-60 ${step === 2 ? "py-2.5" : "py-3"}`}
                >
                  {loading ? "Hang tight…" : step === 2 ? "Launch me in!" : "Continue"}
                </button>
              </div>
            </form>

            <p className={`text-center text-sm text-zinc-500 ${step === 2 ? "mt-4" : "mt-6"}`}>
              Have an account?{" "}
              <Link href="/login" className="text-zinc-300 hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
