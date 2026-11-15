import type { MetadataRoute } from "next";

/** Signed-in, staff and checkout pages. They are also marked noindex; this keeps crawlers off them. */
const PRIVATE = [
  "/admin",
  "/vendor",
  "/account",
  "/api",
  "/cart",
  "/verify",
  "/kyc",
  "/hold",
  "/orders",
  "/bookings",
  "/reservations",
  "/tickets",
  "/classes",
  "/invoices",
  "/payments",
  "/messages",
  "/notifications",
  "/saved",
  "/blocked",
  "/support",
  "/store",
  "/work",
  "/teach",
  "/gate",
  "/board",
  "/beds",
  "/design",
  "/events/*/book",
  "/courses/*/enrol",
  "/courses/*/demo",
  "/grounds/*/book",
  "/stays/*/reserve",
  "/b/*/order",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE },
    sitemap: "https://ruxstar.com/sitemap.xml",
  };
}
