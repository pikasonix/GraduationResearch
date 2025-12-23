import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Disable Strict Mode in dev to prevent double-mount that interferes with Mapbox GL
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "jrxpkakimcdfecdepmyu.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/avatars/**",
      },
      {
        protocol: "https",
        hostname: "vabheijhjkreincnrfrq.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
      // Allow Google user avatars
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
      // Allow gstatic (Google-hosted) images used by some favicons/brand assets
      {
        protocol: "https",
        hostname: "www.gstatic.com",
        port: "",
        pathname: "/**",
      },
      // Add other allowed hostnames here if needed
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    // Surface Mapbox token to the browser. Prefer NEXT_PUBLIC_ but fall back to NEXT_ for compatibility
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN:
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
  },
};

export default nextConfig;
