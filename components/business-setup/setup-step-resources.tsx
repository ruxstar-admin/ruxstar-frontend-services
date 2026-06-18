"use client";

import type { BusinessResource } from "@/lib/api";
import { priceLabel, resourceCopy, type BookingMode } from "@/lib/business-setup";
import type { ResourcesVariant } from "@/lib/business-setup-flows";

const input = "field-input";

type Props = {
  intro: string;
  typeId: string;
  bookingMode: BookingMode;
  variant?: ResourcesVariant;
  showHallFields: boolean;
  resources: BusinessResource[];
  resourceName: string;
  resourcePrice: string;
  resourceCapacity: string;
  resourceDescription: string;
  onResourceNameChange: (v: string) => void;
  onResourcePriceChange: (v: string) => void;
  onResourceCapacityChange: (v: string) => void;
  onResourceDescriptionChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<BusinessResource>) => void;
};

export function SetupStepResources({
  intro,
  typeId,
  bookingMode,
  showHallFields,
  resources,
  resourceName,
  resourcePrice,
  resourceCapacity,
  resourceDescription,
  onResourceNameChange,
  onResourcePriceChange,
  onResourceCapacityChange,
  onResourceDescriptionChange,
  onAdd,
  onRemove,
  onUpdate,
}: Props) {
  const copy = resourceCopy(typeId);
  const priceFieldLabel = priceLabel(bookingMode);

  return (
    <div>
      <p className="text-sm font-medium text-zinc-200">{copy.title}</p>
      {intro ? <p className="mt-1 text-sm text-zinc-500">{intro}</p> : null}
      <div className="mt-4 space-y-2">
        <input
          className={input}
          placeholder={copy.placeholder}
          value={resourceName}
          onChange={(e) => onResourceNameChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAdd())}
        />
        <div className="relative max-w-xs">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
            ₹
          </span>
          <input
            className={`${input} w-full py-2 pl-7 text-sm`}
            inputMode="numeric"
            placeholder={priceFieldLabel}
            value={resourcePrice}
            onChange={(e) => onResourcePriceChange(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        {showHallFields && (
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className={input}
              inputMode="numeric"
              placeholder="Max capacity (optional)"
              value={resourceCapacity}
              onChange={(e) => onResourceCapacityChange(e.target.value.replace(/\D/g, ""))}
            />
            <input
              className={input}
              placeholder="Description (optional)"
              value={resourceDescription}
              onChange={(e) => onResourceDescriptionChange(e.target.value)}
            />
          </div>
        )}
        <button
          type="button"
          onClick={onAdd}
          className="w-full rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 sm:w-auto"
        >
          Add
        </button>
      </div>
      {resources.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {resources.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    className={`${input} py-1.5 text-sm`}
                    value={r.name}
                    onChange={(e) => onUpdate(r.id, { name: e.target.value })}
                  />
                  <div className="relative max-w-[10rem]">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                      ₹
                    </span>
                    <input
                      className={`${input} py-1.5 pl-7 text-xs`}
                      inputMode="numeric"
                      placeholder={priceFieldLabel}
                      value={r.pricePerSlot != null ? String(r.pricePerSlot) : ""}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        onUpdate(r.id, {
                          pricePerSlot: v ? Math.round(Number(v)) : undefined,
                        });
                      }}
                    />
                  </div>
                  {showHallFields && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        className={`${input} py-1.5 text-xs`}
                        inputMode="numeric"
                        placeholder="Capacity"
                        value={r.capacity ? String(r.capacity) : ""}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "");
                          onUpdate(r.id, {
                            capacity: v ? Math.round(Number(v)) : undefined,
                          });
                        }}
                      />
                      <input
                        className={`${input} py-1.5 text-xs`}
                        placeholder="Description"
                        value={r.description ?? ""}
                        onChange={(e) =>
                          onUpdate(r.id, {
                            description: e.target.value.trim() || undefined,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(r.id)}
                  className="shrink-0 text-xs text-zinc-500 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-zinc-600">None added yet — add at least one with a price.</p>
      )}
    </div>
  );
}
