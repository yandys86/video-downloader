/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["youtube-dl-exec"]
  }
};

module.exports = nextConfig;
