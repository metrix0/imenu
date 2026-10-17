/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['ogg-opus-decoder'],
  images: {
    // Serve stored images directly from Supabase Storage.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.imenuapp.com.br',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    minimumCacheTTL: 86400,
  },
  async redirects() {
    return [
      {
        source: '/restaurante/dados/termos-e-condicoes',
        destination: '/restaurante/dados/termos',
        permanent: true
      },
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
