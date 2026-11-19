/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone only for the VPS prebuilt release; leave other deployments unchanged.
  ...(process.env.IMENU_STANDALONE_BUILD === '1' ? { output: 'standalone' } : {}),
  serverExternalPackages: ['ogg-opus-decoder', 'ffmpeg-static'],
  outputFileTracingIncludes: {
    '/api/menu/item-video': ['./node_modules/ffmpeg-static/ffmpeg*'],
  },
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
  async headers() {
    return [
      {
        source: '/afiliados/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
      }
    ];
  },
  async redirects() {
    return [
      {
        source: '/restaurante/dados/termos-e-condicoes',
        destination: '/restaurante/dados/termos',
        permanent: true
      },
      {
        source: '/painel/automacoes',
        destination: '/painel/marketing',
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
