import { getHeapStatistics } from "node:v8";
import { Pool, type PoolClient } from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5_000,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
});

type RuntimeMetrics = {
    pools: Set<Pool>;
    acquired: number;
    acquisitionFailures: number;
    acquisitionTimeouts: number;
    maxAcquireMs: number;
    timer?: ReturnType<typeof setInterval>;
};

const runtimeGlobal = globalThis as typeof globalThis & {
    __imenuRuntimeMetrics?: RuntimeMetrics;
};
const metrics = runtimeGlobal.__imenuRuntimeMetrics ??= {
    pools: new Set<Pool>(),
    acquired: 0,
    acquisitionFailures: 0,
    acquisitionTimeouts: 0,
    maxAcquireMs: 0,
};
metrics.pools.add(pool);

if (process.env.NODE_ENV === "production" && !metrics.timer) {
    const timer = setInterval(() => {
        const memory = process.memoryUsage();
        const heapLimit = getHeapStatistics().heap_size_limit;
        let total = 0;
        let idle = 0;
        let waiting = 0;

        for (const currentPool of metrics.pools) {
            total += currentPool.totalCount;
            idle += currentPool.idleCount;
            waiting += currentPool.waitingCount;
        }

        const sample = {
            rss_mb: Math.round(memory.rss / 1048576),
            heap_used_mb: Math.round(memory.heapUsed / 1048576),
            heap_limit_mb: Math.round(heapLimit / 1048576),
            heap_used_percent: Math.round(memory.heapUsed / heapLimit * 100),
            external_mb: Math.round(memory.external / 1048576),
            db_pool_total: total,
            db_pool_active: total - idle,
            db_pool_idle: idle,
            db_pool_waiting: waiting,
            db_acquired_last_minute: metrics.acquired,
            db_acquisition_failures_last_minute: metrics.acquisitionFailures,
            db_acquisition_timeouts_last_minute: metrics.acquisitionTimeouts,
            db_max_acquire_ms_last_minute: metrics.maxAcquireMs,
        };

        if (sample.heap_used_percent >= 75 || sample.db_acquisition_timeouts_last_minute > 0) {
            console.warn("[IMENU_RUNTIME_METRICS]", JSON.stringify(sample));
        } else {
            console.info("[IMENU_RUNTIME_METRICS]", JSON.stringify(sample));
        }

        metrics.acquired = 0;
        metrics.acquisitionFailures = 0;
        metrics.acquisitionTimeouts = 0;
        metrics.maxAcquireMs = 0;
    }, 60_000);
    timer.unref();
    metrics.timer = timer;
}

export async function connectWithMetrics(): Promise<PoolClient> {
    const startedAt = Date.now();
    try {
        const client = await pool.connect();
        metrics.acquired++;
        metrics.maxAcquireMs = Math.max(metrics.maxAcquireMs, Date.now() - startedAt);
        return client;
    } catch (error) {
        metrics.acquisitionFailures++;
        if (error instanceof Error && /timeout exceeded when trying to connect/i.test(error.message)) {
            metrics.acquisitionTimeouts++;
        }
        metrics.maxAcquireMs = Math.max(metrics.maxAcquireMs, Date.now() - startedAt);
        throw error;
    }
}
