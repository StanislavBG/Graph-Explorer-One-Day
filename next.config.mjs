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
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  trailingSlash: true,
  basePath: process.env.NODE_ENV === 'production' ? '/Graph-Explorer-One-Day' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/Graph-Explorer-One-Day' : '',
  // Webpack configuration to resolve module resolution issues
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Development-specific webpack config
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
      // Ensure proper module resolution
      config.resolve.modules = ['node_modules', '.']
    }
    return config
  },
}

export default nextConfig
