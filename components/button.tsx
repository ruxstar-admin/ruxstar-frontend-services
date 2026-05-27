"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: "primary" | "secondary";
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      className = "",
      isLoading = false,
      disabled,
      variant = "primary",
      ...props
    },
    ref,
  ) {
    const isDisabled = disabled || isLoading;

    const variantClasses =
      variant === "primary"
        ? [
            "bg-gradient-to-b from-indigo-500 to-indigo-600 text-white",
            "shadow-glow-sm hover:from-indigo-400 hover:to-indigo-500 hover:shadow-glow",
            "focus-visible:ring-indigo-400/60",
            "disabled:hover:shadow-glow-sm",
          ]
        : [
            "border border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
            "shadow-[0_0_20px_-8px_rgba(16,185,129,0.35)]",
            "hover:border-emerald-400/50 hover:bg-emerald-500/20",
            "focus-visible:ring-emerald-400/50",
          ];

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        className={[
          "group relative inline-flex items-center justify-center gap-2.5",
          "rounded-xl px-6 py-3 text-sm font-medium tracking-wide",
          "transition-all duration-300 ease-out",
          "active:scale-[0.98]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "disabled:active:scale-100",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]",
          ...variantClasses,
          className,
        ].join(" ")}
        {...props}
      >
        {isLoading ? <Spinner /> : null}
        <span>{children}</span>
      </button>
    );
  },
);
