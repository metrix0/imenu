import { Session } from "node:inspector";
import { channel } from "node:diagnostics_channel";
import { chmodSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PerformanceObserver } from "node:perf_hooks";
import { getHeapSpaceStatistics } from "node:v8";

const MIB = 1024 * 1024;
const SAMPLE_INTERVAL = 512 * 1024; // Sample allocations; do not trace every allocation.
const EVIDENCE_DIR = ".next/cache/imenu-heap-evidence";
const MAX_PROFILES = 12;
export const CAPTURE_COOLDOWN_MS = 5 * 60_000;
const MEMORY_HISTORY_LIMIT = 20;
const GC_HISTORY_LIMIT = 48;
const HTTP_MINUTES = 5;

type GcEvent = { timestamp: string; kind: number | null; duration_ms: number; heap_after_mb: number };
type HttpSummary = { requests: number; completed: number; errors: number; max_duration_ms: number };
type HttpMinute = { minute: number; routes: Record<string, HttpSummary> };
type HttpRequest = { minute: number; route: string; startedAt: number };
type MemorySample = { timestamp: string; rss_mb: number; heap_used_mb: number; external_mb: number; db_pool_active: number; db_pool_waiting: number };
const API_GROUPS = new Set("addons auth automatic-promotions categories checkout cron dev health ia-plus ia-vendas ifood internal items loyalty menu mestre meta notify orders printer promotions push qr-table restaurants scan-menu support tools webhooks whatsapp".split(" "));

export type HeapForensicReading = {
    heap_used_mb: number;
    heap_limit_mb: number;
    rss_mb: number;
    heap_used_percent: number;
    [key: string]: number;
};

export type Stage = "baseline" | "growing" | "high" | "critical";
type State = {
    session: Session;
    ready: boolean;
    inFlight: boolean;
    firstHeapMb: number | null;
    lastCaptureAt: number;
    memoryHistory: MemorySample[];
    captured: Set<Stage>;
    directory: string;
    gcHistory: GcEvent[];
    httpMinutes: HttpMinute[];
    httpRequests: WeakMap<object, HttpRequest>;
    gcObserver?: PerformanceObserver;
};

const shared = globalThis as typeof globalThis & { __imenuHeapForensics?: State };

function log(event: string, details: Record<string, unknown>): void {
    console.warn("[IMENU_HEAP_FORENSICS]", JSON.stringify({ event, ...details }));
}

function directory(): string {
    // The prebuilt VPS release binds .next/cache to a persistent per-environment host path.
    const path = join(process.cwd(), EVIDENCE_DIR);
    mkdirSync(path, { recursive: true, mode: 0o700 });
    chmodSync(path, 0o700);
    return path;
}

function readCgroupBytes(filename: string): number | null {
    try {
        const number = Number(readFileSync(join("/sys/fs/cgroup", filename), "utf8").trim());
        return Number.isSafeInteger(number) && number > 0 ? number : null;
    } catch {
        return null;
    }
}

function readCgroupFields(filename: string, fields: string[]): Record<string, number> {
    try {
        const permitted = new Set(fields);
        const result: Record<string, number> = {};
        for (const line of readFileSync(join("/sys/fs/cgroup", filename), "utf8").split("\n")) {
            const [key, raw] = line.split(" ");
            const value = Number(raw);
            if (permitted.has(key) && Number.isSafeInteger(value) && value >= 0) {
                result[key] = filename === "memory.stat" ? Math.round(value / MIB) : value;
            }
        }
        return result;
    } catch {
        return {};
    }
}

function prune(dir: string): void {
    // Keep any historical .heapsnapshot untouched; this implementation never creates one.
    const entries = readdirSync(dir).filter(name => /^heap-\d+-\d+-(baseline|growing|high|critical)\.(json|partial)$/.test(name));
    const files = entries.map(name => ({ name, path: join(dir, name), time: statSync(join(dir, name)).mtimeMs }))
        .sort((a, b) => b.time - a.time);
    for (const extension of [".json", ".partial"]) {
        const keep = extension === ".json" ? MAX_PROFILES : 0;
        for (const stale of files.filter(file => file.name.endsWith(extension)).slice(keep)) {
            try { unlinkSync(stale.path); } catch { /* best-effort retention */ }
        }
    }
}

function secureWrite(path: string, value: unknown): void {
    const temp = path + ".partial";
    writeFileSync(temp, JSON.stringify(value), { mode: 0o600, flag: "wx" });
    renameSync(temp, path);
}

/** Group paths without retaining query strings, restaurant slugs, order IDs or other request data. */
export function requestGroup(url: string): string {
    const parts = url.split("?", 1)[0].split("/").filter(Boolean);
    if (parts.length === 0) return "/";
    if (parts[0] !== "api") return "/pages";
    const feature = parts[1] || "root";
    return API_GROUPS.has(feature) ? `/api/${feature}` : "/api/other";
}

function httpMinute(state: State, minute: number): HttpMinute {
    if (state.httpMinutes.at(-1)?.minute === minute) return state.httpMinutes[state.httpMinutes.length - 1];
    state.httpMinutes = state.httpMinutes.filter(item => item.minute > minute - HTTP_MINUTES);
    let bucket = state.httpMinutes.find(item => item.minute === minute);
    if (!bucket) {
        bucket = { minute, routes: Object.create(null) as Record<string, HttpSummary> };
        state.httpMinutes.push(bucket);
    }
    return bucket;
}

function observeRequestActivity(state: State): void {
    channel("http.server.request.start").subscribe(message => {
        const event = message as { request?: { url?: string } };
        if (!event.request || typeof event.request.url !== "string") return;
        const route = requestGroup(event.request.url);
        const startedAt = Date.now();
        const minute = Math.floor(startedAt / 60_000);
        const bucket = httpMinute(state, minute);
        const stats = bucket.routes[route] ??= { requests: 0, completed: 0, errors: 0, max_duration_ms: 0 };
        stats.requests++;
        state.httpRequests.set(event.request, { minute, route, startedAt });
    });
    channel("http.server.response.finish").subscribe(message => {
        const event = message as { request?: object; response?: { statusCode?: number } };
        if (!event.request) return;
        const started = state.httpRequests.get(event.request);
        if (!started) return;
        state.httpRequests.delete(event.request);
        const bucket = state.httpMinutes.find(item => item.minute === started.minute);
        const stats = bucket?.routes[started.route];
        if (!stats) return;
        stats.completed++;
        if ((event.response?.statusCode ?? 200) >= 500) stats.errors++;
        stats.max_duration_ms = Math.max(stats.max_duration_ms, Date.now() - started.startedAt);
    });
}

function observeGarbageCollection(state: State): void {
    const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
            const detail = (entry as typeof entry & { detail?: { kind?: number } }).detail;
            state.gcHistory.push({
                timestamp: new Date(Date.now()).toISOString(),
                kind: detail?.kind ?? null,
                duration_ms: Math.round(entry.duration * 100) / 100,
                heap_after_mb: Math.round(process.memoryUsage().heapUsed / MIB),
            });
        }
        if (state.gcHistory.length > GC_HISTORY_LIMIT) {
            state.gcHistory.splice(0, state.gcHistory.length - GC_HISTORY_LIMIT);
        }
    });
    observer.observe({ entryTypes: ["gc"] });
    state.gcObserver = observer;
}

function diagnostics(state: State): Record<string, unknown> {
    const memory = process.memoryUsage();
    const minute = Math.floor(Date.now() / 60_000);
    const current = readCgroupBytes("memory.current");
    const limit = readCgroupBytes("memory.max");
    return {
        process_memory_mb: {
            rss: Math.round(memory.rss / MIB), heap_used: Math.round(memory.heapUsed / MIB),
            heap_total: Math.round(memory.heapTotal / MIB), external: Math.round(memory.external / MIB),
            array_buffers: Math.round(memory.arrayBuffers / MIB),
        },
        cgroup_memory_mb: {
            current: current === null ? null : Math.round(current / MIB),
            limit: limit === null ? null : Math.round(limit / MIB),
            ...readCgroupFields("memory.stat", ["anon", "file", "kernel", "slab", "shmem", "sock"]),
        },
        cgroup_events: readCgroupFields("memory.events", ["max", "oom", "oom_kill"]),
        memory_history: state.memoryHistory.slice(),
        gc_recent: state.gcHistory.slice(),
        http_last_5m: state.httpMinutes.filter(item => item.minute > minute - HTTP_MINUTES)
            .map(item => ({ minute: new Date(item.minute * 60_000).toISOString(), routes: item.routes })),
    };
}

function capture(state: State, stage: Stage, reading: HeapForensicReading): void {
    if (state.inFlight || state.captured.has(stage)) return;
    state.inFlight = true;
    state.captured.add(stage);
    state.lastCaptureAt = Date.now();
    const prefix = "heap-" + Date.now() + "-" + process.pid + "-" + stage;
    const finish = (profile: unknown, error?: string) => {
        try {
            secureWrite(join(state.directory, prefix + ".json"), {
                kind: "sampled-allocations", stage, timestamp: new Date().toISOString(),
                node: process.version, pid: process.pid, reading,
                heap_spaces: getHeapSpaceStatistics(), sampling_profile: profile,
                ...diagnostics(state), capture_error: error || null,
            });
            prune(state.directory);
            log("profile-saved", { stage, path: join(state.directory, prefix + ".json"), heap_mb: reading.heap_used_mb });
        } catch (saveError) {
            log("profile-failed", { stage, name: saveError instanceof Error ? saveError.name : "unknown" });
        } finally {
            state.inFlight = false;
        }
    };
    try {
        state.session.post("HeapProfiler.getSamplingProfile", (error, response) => {
            finish(error ? null : response?.profile, error?.message);
        });
    } catch (error) {
        finish(null, error instanceof Error ? error.message : "inspector-unavailable");
    }
}

/** Called once in the server process; no debug port or HTTP endpoint is opened. */
export function startRuntimeHeapForensics(): void {
    if (process.env.NODE_ENV !== "production" || process.env.IMENU_HEAP_FORENSICS === "0" || shared.__imenuHeapForensics) return;
    try {
        const dir = directory();
        prune(dir);
        const session = new Session();
        session.connect();
        const state: State = {
            session, ready: false, inFlight: false, firstHeapMb: null,
            captured: new Set(), lastCaptureAt: 0, memoryHistory: [], directory: dir, gcHistory: [], httpMinutes: [], httpRequests: new WeakMap(),
        };
        shared.__imenuHeapForensics = state;
        observeGarbageCollection(state);
        observeRequestActivity(state);
        session.post("HeapProfiler.enable", (error) => {
            if (error) { log("sampling-unavailable", { reason: error.message }); return; }
            session.post("HeapProfiler.startSampling", { samplingInterval: SAMPLE_INTERVAL }, (samplingError) => {
                if (samplingError) { log("sampling-unavailable", { reason: samplingError.message }); return; }
                state.ready = true;
                log("sampling-started", { interval_bytes: SAMPLE_INTERVAL, directory: dir });
            });
        });
    } catch (error) {
        log("startup-failed", { name: error instanceof Error ? error.name : "unknown" });
    }
}

export function captureStage(
    reading: HeapForensicReading, growth: number, captured: ReadonlySet<Stage>,
    lastCaptureAt = 0, now = Date.now(),
): Stage | null {
    if (lastCaptureAt > 0 && now - lastCaptureAt < CAPTURE_COOLDOWN_MS) return null;
    if (reading.heap_used_percent >= 85) return captured.has("critical") ? null : "critical";
    if (reading.heap_used_percent >= 70) return captured.has("high") ? null : "high";
    if (reading.heap_used_percent >= 43 && growth >= 96) return captured.has("growing") ? null : "growing";
    if (reading.heap_used_percent >= 25 && growth >= 48) return captured.has("baseline") ? null : "baseline";
    return null;
}

/** Reuses the existing 60-second runtime metrics timer; no extra polling or forced GC. */
export function observeRuntimeHeapForensics(reading: HeapForensicReading): void {
    const state = shared.__imenuHeapForensics;
    if (!state?.ready) return;
    const now = Date.now();
    state.memoryHistory.push({
        timestamp: new Date(now).toISOString(), rss_mb: reading.rss_mb,
        heap_used_mb: reading.heap_used_mb, external_mb: reading.external_mb ?? 0,
        db_pool_active: reading.db_pool_active ?? 0, db_pool_waiting: reading.db_pool_waiting ?? 0,
    });
    if (state.memoryHistory.length > MEMORY_HISTORY_LIMIT) {
        state.memoryHistory.splice(0, state.memoryHistory.length - MEMORY_HISTORY_LIMIT);
    }
    if (state.firstHeapMb === null) state.firstHeapMb = reading.heap_used_mb;
    if (state.inFlight) return;
    const stage = captureStage(reading, reading.heap_used_mb - state.firstHeapMb, state.captured, state.lastCaptureAt, now);
    if (stage) capture(state, stage, reading);
}
