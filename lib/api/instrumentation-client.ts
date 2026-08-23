type PosthogClient = typeof import("posthog-js")["default"];

let posthogPromise: Promise<PosthogClient | null> | null = null;

export function getPosthog(): Promise<PosthogClient | null> {
    if (posthogPromise) return posthogPromise;

    const url = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

    if (!url || !key) {
        return Promise.resolve(null);
    }

    posthogPromise = import("posthog-js")
        .then(({ default: posthog }) => {
            posthog.init(key, {
                api_host: url,
                before_send: (event) => {
                    if (
                        typeof window !== "undefined" &&
                        window.location.pathname.startsWith("/painel")
                    ) {
                        const pathname = window.location.pathname;
                        const allowedPath =
                            pathname === "/painel/mesas" ||
                            pathname === "/painel/configuracoes";
                        const allowedEvent =
                            event?.event.startsWith("qr_code_mesa_") ?? false;

                        return allowedPath && allowedEvent ? event : null;
                    }

                    return event;
                },
            });
            return posthog;
        })
        .catch(() => {
            posthogPromise = null;
            return null;
        });

    return posthogPromise;
}
