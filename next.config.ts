import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Shop orders moved into the vendor portal; old links and bookmarks still land.
  redirects: async () => [
    { source: "/sales", destination: "/vendor/orders", permanent: true },
    { source: "/sales/:id", destination: "/vendor/orders/:id", permanent: true },
  ],
};

export default nextConfig;
