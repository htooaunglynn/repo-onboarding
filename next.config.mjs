/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb", // allow large repo uploads
    },
  },
};

export default nextConfig;
