"use client";

import type { BusinessService, PricingModel } from "@/lib/api";
import {
  customerPaymentExplanation,
  customerTimePickerHint,
  formatClassSchedule,
  formatEnrollmentLabel,
  formatMonthYear,
  formatPriceOption,
  isBatchClass,
  isMonthlyClass,
  pricingModelCustomerLabel,
  resolvePriceOption,
} from "@/lib/coaching";

type Props = {
  service: BusinessService;
  selectedDate?: string;
  /** The payment option the customer has chosen (or is about to). Falls back
   * to the class's primary option when omitted. */
  selectedModel?: PricingModel;
};

export function CoachingBookingGuide({ service, selectedDate, selectedModel }: Props) {
  const option = resolvePriceOption(service, selectedModel);
  const monthly = option.pricingModel === "monthly" || isMonthlyClass(service);
  const batch = isBatchClass(service);
  const schedule = formatClassSchedule(service.classTimings);
  const enrollLabel = formatEnrollmentLabel(service.enrollmentType, service.maxParticipants);

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
          {pricingModelCustomerLabel(option.pricingModel)}
        </span>
        {enrollLabel ? (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium text-zinc-400">
            {enrollLabel}
          </span>
        ) : null}
        {service.maxParticipants && service.maxParticipants > 1 ? (
          <span className="text-[10px] text-zinc-500">Max {service.maxParticipants} per slot</span>
        ) : null}
      </div>

      <p className="mt-2 text-sm font-medium text-zinc-100">{service.name}</p>
      <p className="mt-0.5 text-sm text-emerald-300/90">
        {formatPriceOption(option, service.durationMinutes)}
      </p>

      {monthly && selectedDate ? (
        <p className="mt-2 text-xs font-medium text-emerald-200/90">
          Enrolling for {formatMonthYear(selectedDate)}
        </p>
      ) : null}

      <p className="mt-2 text-xs leading-relaxed text-zinc-400">
        {customerPaymentExplanation(service, option.pricingModel)}
      </p>

      {schedule ? (
        <div className="mt-2.5 rounded-lg border border-white/8 bg-black/20 px-2.5 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Class schedule
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-300">{schedule}</p>
        </div>
      ) : null}

      <p className="mt-2.5 text-[11px] text-zinc-500">
        {batch || monthly ? "↓ " : ""}
        {customerTimePickerHint(service, option.pricingModel)}
      </p>
    </div>
  );
}
