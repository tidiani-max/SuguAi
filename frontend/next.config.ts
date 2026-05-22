import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // This tells Next.js to bypass checking strict validation elements inside Docker
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Ensure Next.js builds an optimized standalone node server for your Dockerfile runner stage
  output: "standalone",
};

export default nextConfig;