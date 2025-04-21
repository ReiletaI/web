import withPWA from 'next-pwa'

let userConfig = undefined
try {
  userConfig = (await import('./v0-user-next.config')).default
} catch (e) {
  // ignore error
}

// Configuration de base
/** @type {import('next').NextConfig} */
const baseConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/:path*`,
      },
    ]
  },
}

// Merge avec userConfig si présent
if (userConfig) {
  Object.assign(baseConfig, userConfig)
}

// Enveloppe avec next-pwa
const pwaConfig = {
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
}

// Export final
export default withPWA(pwaConfig)(baseConfig)
