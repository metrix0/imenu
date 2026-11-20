// Public menu reads are shared across modal mounts. Only successful results stay cached.
const FRESH_FOR_MS = 30_000;

export function createMenuRequestCache<T>(read: (key: string) => Promise<T>) {
    const requests = new Map<string, { result: Promise<T>; expiresAt: number }>();

    return (key: string): Promise<T> => {
        const now = Date.now();
        const cached = requests.get(key);
        if (cached && cached.expiresAt > now) return cached.result;

        for (const [id, request] of requests) {
            if (request.expiresAt <= now) requests.delete(id);
        }

        const entry = {
            expiresAt: Infinity,
            result: read(key).then(value => {
                entry.expiresAt = Date.now() + FRESH_FOR_MS;
                return value;
            }, error => {
                requests.delete(key);
                throw error;
            }),
        };
        requests.set(key, entry);
        return entry.result;
    };
}
