import type { BookingMode } from "@/lib/business-setup";

/** Reusable setup step blocks — composed differently per business type. */
export type SetupStepId =
  | "rules"
  | "photos"
  | "hourly-slots"
  | "full-day-days"
  | "resources"
  | "staff"
  | "services"
  | "print-profile"
  | "review";

const PRINT_TYPE_IDS = [
  "print_shop",
  "custom_merch",
  "creator_merch",
  "corporate_printing",
  "event_printing",
  "branding_agency",
];

export type RulesVariant = "venue" | "venue-hourly" | "turf-fullday" | "generic-fullday";
export type ResourcesVariant = "turf" | "venue" | "salon" | "clinic" | "default";

export type SetupStepConfig = {
  id: SetupStepId;
  label: string;
  intro: string;
  props?: {
    rulesVariant?: RulesVariant;
    resourcesVariant?: ResourcesVariant;
    showHallFields?: boolean;
    hideSlotLength?: boolean;
    staffNoun?: string;
  };
};

export type SetupFlow = {
  id: string;
  typeId: string;
  bookingMode: BookingMode;
  title: string;
  steps: SetupStepConfig[];
};

const FINISH_LIVE = "Go live";
const FINISH_EDIT = "Save";

function finish(editMode: boolean) {
  return editMode ? FINISH_EDIT : FINISH_LIVE;
}

/**
 * Each row = one onboarding combination (type + booking style).
 * Add a new row here to give that combo its own steps and questions.
 */
const SETUP_FLOWS: SetupFlow[] = [
  {
    id: "turf-hourly",
    typeId: "turf",
    bookingMode: "slots",
    title: "Sports turf — hourly slots",
    steps: [
      {
        id: "photos",
        label: "Photos",
        intro: "Add more gallery photos (your thumbnail is already set). Up to 3 total.",
      },
      {
        id: "hourly-slots",
        label: "Hours & slots",
        intro: "Open days, play hours, and slot length.",
      },
      {
        id: "resources",
        label: "Courts",
        intro: "Add each court or turf customers book separately.",
        props: { resourcesVariant: "turf", showHallFields: false },
      },
      { id: "review", label: "Review", intro: "Check everything before you go live." },
    ],
  },
  {
    id: "turf-fullday",
    typeId: "turf",
    bookingMode: "fullDay",
    title: "Sports turf — full day",
    steps: [
      {
        id: "rules",
        label: "Rules",
        intro: "Guest limits and rules for full-day turf hire.",
        props: { rulesVariant: "turf-fullday" },
      },
      {
        id: "photos",
        label: "Photos",
        intro: "Add more gallery photos (your thumbnail is already set). Up to 3 total.",
      },
      {
        id: "full-day-days",
        label: "Days & price",
        intro: "Which days can be booked for a full day. Set price on each hall or court.",
      },
      {
        id: "resources",
        label: "Spaces",
        intro: "Add each area that can be booked for a full day, with its own price.",
        props: { resourcesVariant: "turf", showHallFields: true },
      },
      { id: "review", label: "Review", intro: "Ready to accept full-day bookings." },
    ],
  },
  {
    id: "venue-hourly",
    typeId: "venue",
    bookingMode: "slots",
    title: "Party venue — hourly rental",
    steps: [
      {
        id: "rules",
        label: "Rules",
        intro: "House rules and max guests — shown to customers before they book.",
        props: { rulesVariant: "venue-hourly" },
      },
      {
        id: "photos",
        label: "Photos",
        intro: "Add more gallery photos (your thumbnail is already set). Up to 3 total.",
      },
      {
        id: "hourly-slots",
        label: "Hours & slots",
        intro: "When you're open and slot length.",
      },
      {
        id: "resources",
        label: "Halls",
        intro: "Each hall or studio with its own hourly price.",
        props: { resourcesVariant: "venue", showHallFields: true },
      },
      { id: "review", label: "Review", intro: "Launch hourly venue bookings." },
    ],
  },
  {
    id: "venue-fullday",
    typeId: "venue",
    bookingMode: "fullDay",
    title: "Party venue — full day",
    steps: [
      {
        id: "rules",
        label: "Rules",
        intro: "Max guests, catering rules, deposits — customers see this before booking.",
        props: { rulesVariant: "venue" },
      },
      {
        id: "photos",
        label: "Photos",
        intro: "Add more gallery photos (your thumbnail is already set). Up to 3 total.",
      },
      {
        id: "full-day-days",
        label: "Days & price",
        intro: "Which days can be booked. Set price on each hall.",
      },
      {
        id: "resources",
        label: "Halls",
        intro: "Each hall with its own full-day price.",
        props: { resourcesVariant: "venue", showHallFields: true },
      },
      { id: "review", label: "Review", intro: "Launch full-day party bookings." },
    ],
  },
  {
    id: "salon-services",
    typeId: "salon",
    bookingMode: "services",
    title: "Salon & spa",
    steps: [
      {
        id: "photos",
        label: "Photos",
        intro: "Add more gallery photos (your thumbnail is already set). Up to 3 total.",
      },
      {
        id: "hourly-slots",
        label: "Hours",
        intro: "The hours you're open for appointments.",
        props: { hideSlotLength: true },
      },
      {
        id: "staff",
        label: "Staff",
        intro: "Add the stylists or therapists who take appointments.",
        props: { staffNoun: "stylist" },
      },
      {
        id: "services",
        label: "Services",
        intro: "Each service with its duration, price, and who can perform it.",
      },
      { id: "review", label: "Review", intro: "Start taking salon appointments." },
    ],
  },
  {
    id: "clinic-services",
    typeId: "clinic",
    bookingMode: "services",
    title: "Clinic & consultation",
    steps: [
      {
        id: "photos",
        label: "Photos",
        intro: "Add more gallery photos (your thumbnail is already set). Up to 3 total.",
      },
      {
        id: "hourly-slots",
        label: "Hours",
        intro: "Consultation hours patients can book within.",
        props: { hideSlotLength: true },
      },
      {
        id: "staff",
        label: "Doctors",
        intro: "Add the doctors or practitioners patients can book.",
        props: { staffNoun: "doctor" },
      },
      {
        id: "services",
        label: "Consultations",
        intro: "Each consultation type with its length, fee, and practitioner.",
      },
      { id: "review", label: "Review", intro: "Go live for patient bookings." },
    ],
  },
  {
    id: "coaching-services",
    typeId: "coaching",
    bookingMode: "services",
    title: "Coaching & classes",
    steps: [
      {
        id: "photos",
        label: "Photos",
        intro: "Add more gallery photos (your thumbnail is already set). Up to 3 total.",
      },
      {
        id: "hourly-slots",
        label: "Hours",
        intro: "The hours you run sessions.",
        props: { hideSlotLength: true },
      },
      {
        id: "staff",
        label: "Coaches",
        intro: "Add the coaches or instructors students can book.",
        props: { staffNoun: "coach" },
      },
      {
        id: "services",
        label: "Sessions",
        intro: "Each session type with its length, price, and coach.",
      },
      { id: "review", label: "Review", intro: "Open for class bookings." },
    ],
  },
];

const DEFAULT_FLOW: SetupFlow = {
  id: "default-slots",
  typeId: "_default",
  bookingMode: "slots",
  title: "Bookable business",
  steps: [
    { id: "photos", label: "Photos", intro: "Add more gallery photos (your thumbnail is already set). Up to 3 total." },
    {
      id: "hourly-slots",
      label: "Hours & slots",
      intro: "Availability, slot length, and pricing.",
    },
    {
      id: "resources",
      label: "Resources",
      intro: "What customers reserve.",
      props: { resourcesVariant: "default", showHallFields: false },
    },
    { id: "review", label: "Review", intro: "Review and go live." },
  ],
};

const PRINT_FLOW: SetupFlow = {
  id: "print-on-demand",
  typeId: "_print",
  bookingMode: "slots",
  title: "Print on demand",
  steps: [
    {
      id: "photos",
      label: "Photos",
      intro: "Add sample work or shop photos (your thumbnail is already set). Up to 3 total.",
    },
    {
      id: "print-profile",
      label: "Products & area",
      intro: "Pick the print categories you offer and the cities you serve.",
    },
    { id: "review", label: "Review", intro: "Go live to start receiving print orders." },
  ],
};

export function resolveSetupFlow(typeId: string, bookingMode: BookingMode): SetupFlow {
  if (PRINT_TYPE_IDS.includes(typeId)) return { ...PRINT_FLOW, typeId };

  const mode: BookingMode =
    bookingMode === "fullDay" ? "fullDay" : bookingMode === "services" ? "services" : "slots";
  const fallbackMode: BookingMode = mode === "services" ? "services" : "slots";
  const match =
    SETUP_FLOWS.find((f) => f.typeId === typeId && f.bookingMode === mode) ??
    SETUP_FLOWS.find((f) => f.typeId === typeId && f.bookingMode === fallbackMode);
  return match ?? { ...DEFAULT_FLOW, typeId };
}

export function setupFlowStepLabels(flow: SetupFlow, editMode: boolean): string[] {
  return flow.steps.map((s) => (s.id === "review" ? finish(editMode) : s.label));
}

export function listSetupFlows(): SetupFlow[] {
  return SETUP_FLOWS;
}

export const RULES_PLACEHOLDERS: Record<RulesVariant, string> = {
  venue: "e.g. No outside catering. Music off by 11 PM. ₹5000 security deposit.",
  "venue-hourly": "e.g. Studio rules, equipment care, minimum 2-hour booking.",
  "turf-fullday": "e.g. Full-day hire only. Bring your own balls. No studs.",
  "generic-fullday": "e.g. Full-day booking terms and conditions.",
};
