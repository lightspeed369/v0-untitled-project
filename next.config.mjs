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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Railway already 301s http -> https, but a browser typing the bare
          // hostname still makes one plain-HTTP request first, and Chrome flags that
          // moment as "not secure". HSTS tells the browser to go straight to HTTPS
          // from then on, so that first insecure hop never happens again.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ]
  },
}

export default nextConfig