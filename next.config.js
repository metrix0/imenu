/** @type {import('next').NextConfig} */
const nextConfig = {
    async redirects() {
        return [
            {
                source: "/:path*",
                has: [
                    {
                        type: "host",
                        value: "www.imenuapp.com.br",
                    },
                ],
                destination: "https://imenuapp.com.br/:path*",
                permanent: true,
            },
        ];
    },
};

module.exports = nextConfig;
