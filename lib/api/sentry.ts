import * as Sentry from "@sentry/nextjs";

export async function safe<T>(fn: () => Promise<T>) {
    try {
        return await fn();
    } catch (err) {
        Sentry.captureException(err);
        throw err;
    }
}
