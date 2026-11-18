/**
 * Questions on the home page (ruxstar.com/#faq). Edit freely; keep each answer to a few sentences, and don't repeat what
 * the sections above already say.
 * `link` adds one link after the answer.
 */
export interface Faq {
  question: string;
  answer: string;
  link?: { href: string; label: string };
}

export const FAQ: Faq[] = [
  {
    question: "Do I need an account to look around?",
    answer:
      "No. You only sign in when you book, buy, follow, message or post, and we bring you back to the page you were on.",
    link: { href: "/discover", label: "Start browsing" },
  },
  {
    question: "How do I cancel a booking or order?",
    answer:
      "Open it in the app and cancel from there. Whether you get money back, and how much, depends on the rule shown on the listing when you paid.",
    link: { href: "/refunds", label: "Read the refund policy" },
  },
  {
    question: "How do I get help with an order?",
    answer:
      "Sign in and open Help & support from your profile, or email admin@ruxstar.com with your order number. We reply within 2 working days.",
    link: { href: "/contact", label: "Contact us" },
  },
  {
    question: "Can I delete my account?",
    answer: "Yes. You can delete it from your account settings, or follow the steps on our account deletion page.",
    link: { href: "/delete-account", label: "How to delete your account" },
  },
];
