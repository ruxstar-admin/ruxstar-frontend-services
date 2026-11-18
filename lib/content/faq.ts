/**
 * Questions on the home page (ruxstar.com/#faq). Edit freely; keep each answer to a few sentences.
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
      "No. Events, courses, sports grounds, PGs and hostels, and local shops are open to browse without signing in. We ask you to sign in when you book, buy, pay, follow, message or post, and bring you back to the same page afterwards.",
    link: { href: "/discover", label: "Start browsing" },
  },
  {
    question: "Which cities is Ruxstar in?",
    answer: "Vijayawada, Gudivada and Hyderabad. Some businesses, like print shops, can deliver further; each one shows where it delivers.",
  },
  {
    question: "How do I pay, and is it safe?",
    answer:
      "You pay at checkout through Cashfree, our payment gateway. Your card and bank details go to Cashfree, not to Ruxstar or the business.",
  },
  {
    question: "What if I need to cancel?",
    answer:
      "Every event, course, ground, stay and shop shows its own cancellation and refund rule before you pay, so you know where you stand. Refunds go back to the way you paid.",
    link: { href: "/refunds", label: "Read the refund policy" },
  },
  {
    question: "How are businesses checked?",
    answer:
      "Before a business can take payments, its owner passes an identity check with Aadhaar, PAN and a selfie. Only people who booked or bought from a business can review it.",
  },
  {
    question: "I run a business. How do I join?",
    answer:
      "Create an account, add your business, pass the identity check and list what you offer. Ruxstar takes 0% commission at launch, and bookings, orders, your team and payouts all live in one app.",
    link: { href: "/signin", label: "List your business" },
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
