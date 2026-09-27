/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: '/WorkLedger',
  output: 'export',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;