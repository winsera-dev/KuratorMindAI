import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Allow images from Supabase storage
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cqhzojqptqnxyvotqjoj.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
