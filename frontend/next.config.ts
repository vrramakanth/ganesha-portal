import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /admin is an alias for the /volunteer section (renamed on the resident
  // home page link to "Admin Login") — redirect rather than duplicate the
  // route tree, so both URLs reach the same pages.
  async redirects() {
    return [
      { source: "/admin", destination: "/volunteer", permanent: false },
      { source: "/admin/:path*", destination: "/volunteer/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
