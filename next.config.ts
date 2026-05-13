import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";

// Load `.env*` into `process.env` before Next reads config (helps tooling and consistency).
loadEnvConfig(process.cwd());

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
