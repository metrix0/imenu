import type { MetadataRoute } from "next";

const SITE_URL = "https://www.imenuapp.com.br";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: [
                    "Googlebot",
                    "Googlebot-Image",
                    "Google-InspectionTool",
                    "AdsBot-Google",
                    "Mediapartners-Google",
                    "GoogleOther",
                ],
                allow: "/",
            },
            {
                userAgent: "*",
                disallow: "/",
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
