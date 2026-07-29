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
      // Next prerenders "/" and "/admin" and serves them with
      // `cache-control: s-maxage=31536000` and no browser directive. iOS Safari then
      // heuristically caches the HTML and reuses it without revalidating, so a phone
      // keeps showing the previous build after a deploy — this cost a full "you didn't
      // fix it" round-trip on 2026-07-28. Worse than cosmetic: stale HTML references
      // the old build's content-hashed chunk filenames, which no longer exist after a
      // deploy, so the app can fail to boot rather than merely look out of date.
      //
      // `no-cache` still lets the browser store the response; it just has to
      // revalidate, which the existing ETag answers with a cheap 304.
      //
      // Scoped to the two document routes on purpose. Do NOT widen this to "/:path*" —
      // that would also strip immutable caching from /_next/static, whose filenames are
      // content-hashed and are safe (and important) to cache forever.
      ...["/", "/admin"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      })),
    ]
  },
}

export default nextConfig