
import * as Sentry from "@sentry/nextjs";

export function proxy(req: Request) {
    Sentry.setTag("path", new URL(req.url).pathname);
}
