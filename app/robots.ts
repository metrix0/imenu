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
                // Search discovery and user-initiated AI page retrieval.
                userAgent: [
                    "OAI-SearchBot",
                    "ChatGPT-User",
                    "PerplexityBot",
                    "Perplexity-User",
                    "Claude-SearchBot",
                    "Claude-User",
                    "bingbot",
                    "Applebot",
                    "DuckAssistBot",
                    "MistralAI-Index",
                    "MistralAI-User",
                    "Meta-WebIndexer",
                    "Meta-ExternalFetcher",
                    "Amzn-SearchBot",
                    "Amzn-User",
                    "YouBot",
                ],
                allow: "/",
            },
            {
                // AI training must stay excluded independently of search.
                userAgent: [
                    "GPTBot",
                    "ClaudeBot",
                    "Google-Extended",
                    "Applebot-Extended",
                    "MistralAI-Training",
                    "Meta-ExternalAgent",
                    "Amazonbot",
                ],
                disallow: "/",
            },
            {
                userAgent: "*",
                disallow: "/",
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
