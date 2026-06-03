"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoginMascot } from "@/components/login-mascot";
import { Particles } from "@/components/particles";
import { homeForUser, postAuth, saveSession } from "@/lib/api";

const input =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none transition focus:border-white/30 focus:bg-white/[0.07]";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [otpStep, setOtpStep] = useState(0);
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  function fail(msg: string) {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mobile.length !== 10) throw new Error("Enter a 10-digit mobile number.");

      if (mode === "password") {
        if (!password) throw new Error("Enter your password.");
        const res = await postAuth("login", { mobile, password });
        saveSession(res.token, res.user);
        router.push(homeForUser(res.user));
        return;
      }

      if (otpStep === 0) {
        const res = await postAuth("login/send-otp", { mobile });
        if (res.otp) setDevOtp(res.otp);
        setOtpStep(1);
      } else {
        if (!otp) throw new Error("Enter the OTP.");
        const res = await postAuth("login/verify-otp", { mobile, otp });
        saveSession(res.token, res.user);
        router.push(homeForUser(res.user));
      }
    } catch (err) {
      fail(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: "password" | "otp") {
    setMode(next);
    setOtpStep(0);
    setError("");
    setOtp("");
    setDevOtp("");
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0" />
        <div className="spotlight absolute inset-0" />
        <div className="grade-overlay absolute inset-0" />
      </div>
      <Particles />

      <header className="reveal relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">Ruxstar</Link>
        <Link href="/signup" className="glass rounded-full px-5 py-2 text-sm font-medium transition hover:bg-white/10">
          Sign up
        </Link>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-5.5rem)] max-w-6xl items-center gap-10 px-6 pb-16 lg:grid-cols-2 lg:gap-16">
        <div className="reveal order-2 lg:order-1" style={{ animationDelay: "0.1s" }}>
          <LoginMascot mode={mode} otpStep={otpStep} loading={loading} shake={shake} error={error} />
        </div>

        <div className="reveal order-1 lg:order-2" style={{ animationDelay: "0.2s" }}>
          <div className="glass rounded-2xl p-6 sm:p-8 lg:p-10">
            <h1 className="text-2xl font-semibold sm:text-3xl">
              <span className="text-gradient">Log in</span>
            </h1>

            <div className="mt-6 flex gap-2 rounded-full border border-white/10 p-1">
              {(["password", "otp"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`flex-1 rounded-full py-2 text-sm transition ${mode === m ? "bg-white/15 font-medium" : "text-zinc-400 hover:text-zinc-200"}`}
                >
                  {m === "password" ? "Password" : "OTP"}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className="block text-sm text-zinc-400">
                Mobile (+91)
                <input
                  className={`${input} mt-2`}
                  inputMode="numeric"
                  placeholder="9876543210"
                  value={mobile}
                  onChange={(e) => {
                    setError("");
                    setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
                  }}
                />
              </label>

              {mode === "password" && (
                <label className="block text-sm text-zinc-400">
                  Password
                  <div className="relative mt-2">
                    <input
                      type={showPassword ? "text" : "password"}
                      className={`${input} pr-11`}
                      value={password}
                      onChange={(e) => {
                        setError("");
                        setPassword(e.target.value);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
              )}

              {mode === "otp" && otpStep === 1 && (
                <>
                  {devOtp && (
                    <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
                      Dev OTP: <span className="font-mono font-semibold">{devOtp}</span>
                    </p>
                  )}
                  <label className="block text-sm text-zinc-400">
                    OTP
                    <input
                      className={`${input} mt-2 tracking-[0.35em]`}
                      inputMode="numeric"
                      placeholder="••••••"
                      value={otp}
                      onChange={(e) => {
                        setError("");
                        setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                      }}
                    />
                  </label>
                </>
              )}

              <div className="flex gap-3 pt-2">
                {mode === "otp" && otpStep === 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep(0);
                      setError("");
                      setOtp("");
                    }}
                    className="flex-1 rounded-full border border-white/10 py-2.5 text-sm hover:bg-white/5"
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1 rounded-full py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {loading ? "Please wait…" : mode === "otp" && otpStep === 0 ? "Send OTP" : "Log in"}
                </button>
              </div>
            </form>

            <p className="mt-6 text-center text-sm text-zinc-500">
              New here?{" "}
              <Link href="/signup" className="text-zinc-300 hover:underline">Sign up</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
