import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  "allowedDevOrigins":["localhost","192.168.0.100"],
   webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
