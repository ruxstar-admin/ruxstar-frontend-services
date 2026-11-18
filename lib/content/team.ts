/**
 * The Founders and Board on the home page (ruxstar.com/#team).
 *
 * PLACEHOLDER: every entry below is a stand-in until the owner sends real details. Replace the name, role, bio and
 * LinkedIn link, and delete `placeholder: true`.
 *
 * Photos: put a square photo (at least 400 × 400 px, JPG or WebP) in `public/team/`, for example
 * `public/team/asha-rao.jpg`, and set `photo: "/team/asha-rao.jpg"`. Without a photo the card shows the person's initials.
 * The LinkedIn link only shows when `linkedin` is filled in.
 */
export interface Person {
  name: string;
  role: string;
  /** About two lines on the card: one or two short sentences. */
  bio: string;
  /** Full profile URL, such as https://www.linkedin.com/in/username */
  linkedin?: string;
  /** Path under `public/`, such as "/team/asha-rao.jpg" */
  photo?: string;
  placeholder?: boolean;
}

export const FOUNDERS: Person[] = [
  {
    name: "Founder name",
    role: "Co-founder & CEO",
    bio: "PLACEHOLDER. Two lines on what they did before Ruxstar and what they look after now.",
    placeholder: true,
  },
  {
    name: "Founder name",
    role: "Co-founder & CTO",
    bio: "PLACEHOLDER. Two lines on what they did before Ruxstar and what they look after now.",
    placeholder: true,
  },
];

export const BOARD: Person[] = [
  {
    name: "Board member name",
    role: "Board member",
    bio: "PLACEHOLDER. Two lines on their background and how they help Ruxstar.",
    placeholder: true,
  },
  {
    name: "Board member name",
    role: "Board member",
    bio: "PLACEHOLDER. Two lines on their background and how they help Ruxstar.",
    placeholder: true,
  },
  {
    name: "Advisor name",
    role: "Advisor",
    bio: "PLACEHOLDER. Two lines on their background and how they help Ruxstar.",
    placeholder: true,
  },
];

/** "Founder name" → "FN". */
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
