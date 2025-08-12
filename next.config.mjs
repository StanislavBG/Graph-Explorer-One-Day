/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // GitHub Pages configuration
  output: 'export',
  trailingSlash: true,
  basePath: process.env.NODE_ENV === 'production' ? '/Graph-Explorer-One-Day' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/Graph-Explorer-One-Day' : '',
}

export default nextConfig
