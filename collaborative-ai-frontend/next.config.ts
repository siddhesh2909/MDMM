import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://collaborative-ai-platform.vercel.app'
        : 'http://localhost:5001');

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`
      }
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
