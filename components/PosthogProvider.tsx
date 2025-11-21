"use client";

import { ReactNode, useEffect } from "react";
import posthog from "@/lib/instrumentation-client";

export default function PosthogProvider({ children }: { children: ReactNode }) {

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

    if (!url || !key) {
      console.error("PostHog envs missing");
      return;
    }

    posthog.init(key, {
      api_host: url,
    });
  }, []);

  return <>{children}</>;
}
