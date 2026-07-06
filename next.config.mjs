import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this project (a stray lockfile lives in the
  // parent directory, which would otherwise confuse Next's root inference).
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
