"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { capturePosthogLightweight } from "@/lib/api/instrumentation-client";
import { supabase } from "@/lib/database/supabaseClient";

type PlusExposureSurface =
    | "sales_modal"
    | "plus_page"
    | "assistant_limit"
    | "sales_section"
    | "marketing_page";

/** Tracks an actual visible Plus touchpoint, not a background mount or a tab click. */
export function usePlusExposure(surface: PlusExposureSurface, enabled = true) {
    const [element, setElement] = useState<HTMLElement | null>(null);
    const recorded = useRef(false);
    const attach = useCallback((node: HTMLElement | null) => setElement(node), []);

    useEffect(() => {
        if (!enabled) {
            recorded.current = false;
            return;
        }
        if (!element) return;

        let inView = false;
        const capture = () => {
            if (!inView || recorded.current || document.visibilityState !== "visible") return;
            recorded.current = true;
            void supabase.auth.getSession().then(({ data: { session } }) => {
                if (session?.user?.id) {
                    capturePosthogLightweight("imenu_plus_exposure_viewed", session.user.id, { surface });
                } else {
                    recorded.current = false;
                }
            }).catch(() => { recorded.current = false; });
        };

        const observer = typeof IntersectionObserver !== "undefined"
            ? new IntersectionObserver(entries => {
                inView = entries.some(entry => entry.isIntersecting);
                capture();
            }, { threshold: 0.1 })
            : null;
        if (observer) observer.observe(element);
        else { inView = true; capture(); }

        document.addEventListener("visibilitychange", capture);
        return () => {
            observer?.disconnect();
            document.removeEventListener("visibilitychange", capture);
        };
    }, [element, enabled, surface]);

    return attach;
}
