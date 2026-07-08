import type { PrintCategory, PrintOrderAttributes, PrintRequirementField, PrintRequirementType } from "@/lib/api";

const SELECT_KEYS = new Set(["size", "material", "printType", "color"]);

/** Mirrors backend printCatalog — used when API has not yet sent `requirements`. */
const STATIC_REQUIREMENTS: Record<string, PrintRequirementField[]> = {
  tshirts: [
    { key: "size", label: "T-shirt size", type: "select", required: true, hint: "", placeholder: "" },
    { key: "material", label: "Fabric", type: "select", required: true, hint: "", placeholder: "" },
    { key: "printType", label: "Print method", type: "select", required: false, hint: "", placeholder: "" },
    { key: "color", label: "Print colour", type: "select", required: false, hint: "", placeholder: "" },
    {
      key: "placement",
      label: "Print placement",
      type: "text",
      required: true,
      hint: "",
      placeholder: "e.g. Front chest, full back, sleeve",
    },
    {
      key: "designImage",
      label: "Artwork",
      type: "file",
      required: true,
      hint: "Upload your logo or graphic",
      placeholder: "",
    },
  ],
  hoodies: [
    { key: "size", label: "Hoodie size", type: "select", required: true, hint: "", placeholder: "" },
    { key: "material", label: "Fabric", type: "select", required: false, hint: "", placeholder: "" },
    { key: "printType", label: "Print / embroidery", type: "select", required: false, hint: "", placeholder: "" },
    { key: "color", label: "Garment colour", type: "select", required: false, hint: "", placeholder: "" },
    {
      key: "placement",
      label: "Print placement",
      type: "text",
      required: false,
      hint: "",
      placeholder: "Front, back, hood, sleeve…",
    },
    { key: "designImage", label: "Artwork", type: "file", required: true, hint: "", placeholder: "" },
  ],
  jerseys: [
    { key: "size", label: "Jersey size", type: "select", required: true, hint: "", placeholder: "" },
    { key: "material", label: "Fabric", type: "select", required: true, hint: "", placeholder: "" },
    { key: "printType", label: "Print method", type: "select", required: true, hint: "", placeholder: "" },
    { key: "color", label: "Primary colour", type: "select", required: false, hint: "", placeholder: "" },
    {
      key: "teamName",
      label: "Team / club name",
      type: "text",
      required: true,
      hint: "",
      placeholder: "Team or academy name",
    },
    {
      key: "playerDetails",
      label: "Names & numbers",
      type: "textarea",
      required: false,
      hint: "",
      placeholder: "Player names, numbers, sizes (one per line)",
    },
    {
      key: "designImage",
      label: "Team logo / design",
      type: "file",
      required: true,
      hint: "Upload logo and layout reference",
      placeholder: "",
    },
  ],
  business_cards: [
    { key: "size", label: "Card size", type: "select", required: true, hint: "", placeholder: "" },
    { key: "material", label: "Paper stock", type: "select", required: true, hint: "", placeholder: "" },
    { key: "printType", label: "Sides & finish", type: "select", required: true, hint: "", placeholder: "" },
    { key: "color", label: "Colour mode", type: "select", required: true, hint: "", placeholder: "" },
    {
      key: "contactDetails",
      label: "Contact info to print",
      type: "textarea",
      required: true,
      hint: "",
      placeholder: "Name, phone, email, address, website…",
    },
    {
      key: "designImage",
      label: "Card design",
      type: "file",
      required: true,
      hint: "Upload front/back artwork",
      placeholder: "",
    },
  ],
  posters: [
    { key: "size", label: "Poster size", type: "select", required: true, hint: "", placeholder: "" },
    { key: "material", label: "Paper / material", type: "select", required: true, hint: "", placeholder: "" },
    { key: "printType", label: "Print type", type: "select", required: false, hint: "", placeholder: "" },
    { key: "color", label: "Colour mode", type: "select", required: false, hint: "", placeholder: "" },
    {
      key: "finishing",
      label: "Finishing",
      type: "text",
      required: false,
      hint: "",
      placeholder: "Lamination, mounting, eyelets…",
    },
    { key: "designImage", label: "Poster artwork", type: "file", required: true, hint: "", placeholder: "" },
  ],
  flex_banners: [
    { key: "size", label: "Banner dimensions", type: "select", required: true, hint: "", placeholder: "" },
    { key: "material", label: "Banner material", type: "select", required: true, hint: "", placeholder: "" },
    { key: "printType", label: "Banner type", type: "select", required: true, hint: "", placeholder: "" },
    {
      key: "customDimensions",
      label: "Exact size (if custom)",
      type: "text",
      required: false,
      hint: "",
      placeholder: "Width × height in feet or metres",
    },
    {
      key: "installation",
      label: "Installation needs",
      type: "text",
      required: false,
      hint: "",
      placeholder: "Eyelets, pole pockets, rope, stand…",
    },
    {
      key: "designImage",
      label: "Banner artwork",
      type: "file",
      required: true,
      hint: "High-resolution file preferred",
      placeholder: "",
    },
  ],
  stickers: [
    { key: "size", label: "Sticker size", type: "select", required: true, hint: "", placeholder: "" },
    { key: "material", label: "Sticker material", type: "select", required: true, hint: "", placeholder: "" },
    { key: "printType", label: "Cut type", type: "select", required: true, hint: "", placeholder: "" },
    { key: "color", label: "Colour mode", type: "select", required: false, hint: "", placeholder: "" },
    {
      key: "shape",
      label: "Shape / outline",
      type: "text",
      required: false,
      hint: "",
      placeholder: "Circle, rectangle, custom die-cut…",
    },
    { key: "designImage", label: "Sticker artwork", type: "file", required: true, hint: "", placeholder: "" },
  ],
  invitations: [
    { key: "size", label: "Invite size", type: "select", required: true, hint: "", placeholder: "" },
    { key: "material", label: "Paper type", type: "select", required: true, hint: "", placeholder: "" },
    { key: "printType", label: "Card style", type: "select", required: true, hint: "", placeholder: "" },
    { key: "color", label: "Colour theme", type: "select", required: false, hint: "", placeholder: "" },
    {
      key: "eventDate",
      label: "Event date",
      type: "text",
      required: true,
      hint: "",
      placeholder: "Date and time of event",
    },
    {
      key: "eventDetails",
      label: "Event wording",
      type: "textarea",
      required: false,
      hint: "",
      placeholder: "Names, venue, RSVP line…",
    },
    { key: "designImage", label: "Invite design", type: "file", required: true, hint: "", placeholder: "" },
  ],
  photo_prints: [
    { key: "size", label: "Print size", type: "select", required: true, hint: "", placeholder: "" },
    { key: "material", label: "Finish", type: "select", required: true, hint: "", placeholder: "" },
    { key: "printType", label: "Print style", type: "select", required: false, hint: "", placeholder: "" },
    {
      key: "cropNotes",
      label: "Crop / border instructions",
      type: "text",
      required: false,
      hint: "",
      placeholder: "Full bleed, white border, crop area…",
    },
    {
      key: "designImage",
      label: "Photo file",
      type: "file",
      required: true,
      hint: "Upload the photo to print",
      placeholder: "",
    },
  ],
  documents: [
    { key: "size", label: "Paper size", type: "select", required: true, hint: "", placeholder: "" },
    { key: "printType", label: "Binding / sides", type: "select", required: true, hint: "", placeholder: "" },
    { key: "color", label: "Print mode", type: "select", required: true, hint: "", placeholder: "" },
    {
      key: "pageCount",
      label: "Number of pages",
      type: "text",
      required: true,
      hint: "",
      placeholder: "Total pages to print",
    },
    {
      key: "designImage",
      label: "Document scan",
      type: "file",
      required: false,
      hint: "Optional — share files with the vendor after accept",
      placeholder: "",
    },
  ],
};

export function categoryRequirements(category: PrintCategory): PrintRequirementField[] {
  if (category.requirements?.length) return category.requirements;
  if (STATIC_REQUIREMENTS[category.id]) return STATIC_REQUIREMENTS[category.id];
  return [];
}

export function requirementOptions(
  category: PrintCategory,
  key: string,
): string[] {
  switch (key) {
    case "size":
      return category.sizes;
    case "material":
      return category.materials;
    case "printType":
      return category.printTypes;
    case "color":
      return category.colorOptions;
    default:
      return [];
  }
}

export function isSelectRequirement(field: PrintRequirementField) {
  return field.type === "select" || SELECT_KEYS.has(field.key);
}

export function formatPrintOrderAttributes(attrs: PrintOrderAttributes): string {
  const parts = [attrs.size, attrs.material, attrs.printType, attrs.color].filter(Boolean);
  if (attrs.extras) {
    for (const value of Object.values(attrs.extras)) {
      if (value.trim()) parts.push(value.trim());
    }
  }
  return parts.join(" · ");
}

const ATTR_LABELS: Record<string, string> = {
  size: "Size",
  material: "Material",
  printType: "Print type",
  color: "Colour",
};

function humanizeExtraKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Labelled rows for vendor/customer order detail — size, material, print type, colour, extras. */
export function orderAttributeRows(
  attrs: PrintOrderAttributes,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const key of ["size", "material", "printType", "color"] as const) {
    const value = attrs[key]?.trim();
    if (value) rows.push({ label: ATTR_LABELS[key], value });
  }
  if (attrs.extras) {
    for (const [key, value] of Object.entries(attrs.extras)) {
      const v = value.trim();
      if (v) rows.push({ label: humanizeExtraKey(key), value: v });
    }
  }
  return rows;
}

export function notesPlaceholder(category: PrintCategory): string {
  const hints: Record<string, string> = {
    tshirts: "Sizes mix, deadline, delivery preference…",
    hoodies: "Pocket print, sleeve art, delivery date…",
    jerseys: "Extra kits, shorts colour, delivery date…",
    business_cards: "Rounded corners, spot UV, urgent delivery…",
    posters: "Mounting holes, event date…",
    flex_banners: "Delivery address, setup help needed…",
    stickers: "Quantity per design, waterproof needed…",
    invitations: "Envelope colour, RSVP deadline…",
    photo_prints: "Quantity per photo, gift wrap…",
    documents: "Binding colour, pickup time…",
  };
  return hints[category.id] ?? "Anything else the vendor should know…";
}

export type CategoryCardMeta = {
  useCase: string;
  turnaround: string;
  minQtyLabel: string;
  sizePreview: string | null;
  printPreview: string | null;
  materialPreview: string | null;
  requiredLabels: string[];
  optionCount: number;
};

const CATEGORY_USE_CASES: Record<string, { useCase: string; turnaround: string }> = {
  tshirts: { useCase: "Events, teams, merch & giveaways", turnaround: "Usually 2–5 days" },
  hoodies: { useCase: "Winter merch, college fests & crew wear", turnaround: "Usually 3–7 days" },
  jerseys: { useCase: "Sports teams, tournaments & leagues", turnaround: "Usually 5–10 days" },
  business_cards: { useCase: "Networking, shops & professionals", turnaround: "Usually 1–3 days" },
  posters: { useCase: "Events, shops, rooms & promotions", turnaround: "Usually 1–2 days" },
  flex_banners: { useCase: "Shop fronts, events & outdoor ads", turnaround: "Usually 1–3 days" },
  stickers: { useCase: "Branding, packaging & laptop decals", turnaround: "Usually 2–4 days" },
  invitations: { useCase: "Weddings, parties & corporate events", turnaround: "Usually 3–7 days" },
  photo_prints: { useCase: "Gifts, frames & personal keepsakes", turnaround: "Usually same day" },
  documents: { useCase: "Reports, thesis, forms & xerox", turnaround: "Often same day" },
};

function previewOptions(items: string[], max = 3): string | null {
  if (items.length === 0) return null;
  if (items.length <= max) return items.join(" · ");
  return `${items.slice(0, max).join(" · ")} +${items.length - max} more`;
}

export function categoryCardMeta(category: PrintCategory): CategoryCardMeta {
  const reqs = categoryRequirements(category);
  const extra = CATEGORY_USE_CASES[category.id];
  const optionCount =
    category.sizes.length +
    category.materials.length +
    category.printTypes.length +
    category.colorOptions.length;

  return {
    useCase: extra?.useCase ?? "Custom print orders from local vendors",
    turnaround: extra?.turnaround ?? "Vendor will confirm timeline",
    minQtyLabel:
      category.minQuantity > 1
        ? `Min ${category.minQuantity.toLocaleString("en-IN")} pcs`
        : "Min 1 pc",
    sizePreview: previewOptions(category.sizes),
    printPreview: previewOptions(category.printTypes),
    materialPreview: previewOptions(category.materials),
    requiredLabels: reqs.filter((r) => r.required).map((r) => r.label),
    optionCount,
  };
}

export function categorySearchText(category: PrintCategory): string {
  const meta = categoryCardMeta(category);
  return [
    category.label,
    category.description,
    category.id,
    meta.useCase,
    meta.sizePreview,
    meta.printPreview,
    meta.materialPreview,
    ...category.sizes,
    ...category.materials,
    ...category.printTypes,
    ...category.colorOptions,
    ...meta.requiredLabels,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export type { PrintRequirementType };
