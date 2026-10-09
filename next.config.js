/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['ogg-opus-decoder'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mjogdsnxbwhbqcoijrwt.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    minimumCacheTTL: 86400,
  },
  async redirects() {
    return [
      {
        source: '/saborosas-massas-947',
        destination: '/saborosas-massas',
        permanent: false
      }
    ]
  }
};

// Sentry's build wrapper and source-map upload are disabled.
module.exports = nextConfig;
