import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.4", "localhost"],
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
