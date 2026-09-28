/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep each host's public URL independent from the source repository name.
  basePath: process.env.SITE_BASE_PATH ?? (process.env.VERCEL === '1' ? '' : '/WorkLedger'),
  output: 'export',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
