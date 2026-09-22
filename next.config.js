/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['ogg-opus-decoder'],
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
