import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: {
    root: path.resolve(__dirname),
  },
  webpack: (config) => {
    config.output.hashFunction = "sha256";
    return config;
  },
};

export default nextConfig;
