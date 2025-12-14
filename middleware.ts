
import * as Sentry from "@sentry/nextjs";

export function middleware(req: Request) {
    Sentry.setTag("path", new URL(req.url).pathname);
}
