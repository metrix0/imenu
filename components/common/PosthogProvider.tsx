"use client";

import { ReactNode, useEffect } from "react";
import { getPosthog } from "@/lib/api/instrumentation-client";

export default function PosthogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false;

    const startPosthog = () => {
      if (!cancelled) {
        void getPosthog();
      }
    };

    const idleWindow = window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(startPosthog, { timeout: 3000 });
      return () => {
        cancelled = true;
        idleWindow.cancelIdleCallback?.(handle);
      };
    }

    const timeout = window.setTimeout(startPosthog, 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  return <>{children}</>;
}
