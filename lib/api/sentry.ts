export async function safe<T>(fn: () => Promise<T>) {
    try {
        return await fn();
    } catch (err) {
        // Preserve the original error propagation without sending it to Sentry.
        throw err;
    }
}
