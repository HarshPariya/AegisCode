/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Make BACKEND_URL available to server-side code
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || "http://localhost:8000",
  },

  // Proxy /api/* → FastAPI backend (avoids CORS for same-origin calls)
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  // Allow Google fonts and GSI script to load without CSP blocking
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },

  // Suppress the "punycode" deprecation warning from some deps
  webpack(config) {
    config.resolve.fallback = { ...config.resolve.fallback, punycode: false };
    return config;
  },
};

module.exports = nextConfig;
