/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit .next/standalone so the container can run `node server.js` without
  // shipping the full node_modules tree.
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig