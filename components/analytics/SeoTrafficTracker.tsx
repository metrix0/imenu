"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { SEO_TRAFFIC_EVENTS } from "@/lib/analytics/seoTraffic";
import { getPosthog } from "@/lib/api/instrumentation-client";

export default function SeoTrafficTracker() {
    const pathname = usePathname();

    useEffect(() => {
        void getPosthog().then((posthog) => {
            posthog?.capture(SEO_TRAFFIC_EVENTS.pageViewed, {
                path: pathname,
            });
        });

        const handleClick = (event: MouseEvent) => {
            if (!(event.target instanceof Element)) return;
            const target = event.target.closest<HTMLElement>(
                "[data-seo-home-link], a[href='/']"
            );
            if (!target) return;

            void getPosthog().then((posthog) => {
                posthog?.capture(SEO_TRAFFIC_EVENTS.homeClicked, {
                    source_path: pathname,
                });
            });
        };

        document.addEventListener("click", handleClick, true);
        return () => document.removeEventListener("click", handleClick, true);
    }, [pathname]);

    return null;
}
