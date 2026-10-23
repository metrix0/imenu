import { Session } from "node:inspector";
import { chmodSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, statfsSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getHeapSpaceStatistics, writeHeapSnapshot } from "node:v8";

const MIB = 1024 * 1024;
const SAMPLE_INTERVAL = 512 * 1024; // Sample allocations; do not trace every allocation.
const MIN_FREE_DISK = 4 * 1024 ** 3;
const SNAPSHOT_MEMORY_RESERVE = 256 * MIB;
const EVIDENCE_DIR = ".next/cache/imenu-heap-evidence";

export type HeapForensicReading = {
    heap_used_mb: number;
    heap_limit_mb: number;
    rss_mb: number;
    heap_used_percent: number;
    [key: string]: number;
};

type Stage = "baseline" | "growing" | "high" | "critical";
type State = {
    session: Session;
    ready: boolean;
    inFlight: boolean;
    firstHeapMb: number | null;
    captured: Set<Stage>;
    snapshotAttempted: boolean;
    lastSnapshotCheckAt: number;
    directory: string;
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
        const value = readFileSync(join("/sys/fs/cgroup", filename), "utf8").trim();
        const number = Number(value);
        return Number.isSafeInteger(number) && number > 0 ? number : null;
    } catch {
        return null;
    }
}

export function snapshotSafety(reading: HeapForensicReading, cgroupCurrent: number | null, cgroupLimit: number | null, diskFree: number): string | null {
    if (reading.heap_used_percent > 55) return "heap-already-too-high";
    if (cgroupCurrent === null || cgroupLimit === null) return "no-container-memory-limit";
    if (cgroupLimit - cgroupCurrent < reading.heap_used_mb * MIB * 2 + SNAPSHOT_MEMORY_RESERVE) return "insufficient-container-headroom";
    if (diskFree < MIN_FREE_DISK) return "insufficient-free-disk";
    return null;
}

function prune(dir: string): void {
    const entries = readdirSync(dir).filter(name => /^heap-\d+-\d+-(baseline|growing|high|critical)\.(json|heapsnapshot|partial)$/.test(name));
    const files = entries.map(name => ({ name, path: join(dir, name), time: statSync(join(dir, name)).mtimeMs }))
        .sort((a, b) => b.time - a.time);
    for (const extension of [".heapsnapshot", ".json", ".partial"]) {
        const keep = extension === ".heapsnapshot" ? 1 : extension === ".json" ? 6 : 0;
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

function snapshot(state: State, reading: HeapForensicReading, prefix: string): void {
    if (state.snapshotAttempted) return;
    state.lastSnapshotCheckAt = Date.now();
    try {
        const stat = statfsSync(state.directory);
        const diskFree = stat.bavail * stat.bsize;
        const current = readCgroupBytes("memory.current");
        const limit = readCgroupBytes("memory.max");
        const liveHeapMb = Math.ceil(process.memoryUsage().heapUsed / MIB);
        const liveHeapPercent = Math.ceil(liveHeapMb * MIB / (reading.heap_limit_mb * MIB) * 100);
        const safeReading = { ...reading, heap_used_mb: Math.max(reading.heap_used_mb, liveHeapMb), heap_used_percent: Math.max(reading.heap_used_percent, liveHeapPercent) };
        const reason = snapshotSafety(safeReading, current, limit, diskFree);
        if (reason) {
            log("snapshot-skipped", { reason, heap_mb: reading.heap_used_mb, cgroup_current_mb: current === null ? null : Math.round(current / MIB) });
            return;
        }

        state.snapshotAttempted = true; // At most one expensive snapshot per process.
        // V8 snapshots pause the event loop and may consume ~2x live heap.
        // Capture early (43%) with explicit cgroup and disk headroom, only once.
        const partial = join(state.directory, prefix + ".partial");
        const finished = join(state.directory, prefix + ".heapsnapshot");
        writeHeapSnapshot(partial);
        renameSync(partial, finished);
        prune(state.directory);
        log("snapshot-saved", { path: finished, bytes: statSync(finished).size, heap_mb: reading.heap_used_mb });
    } catch (error) {
        log("snapshot-failed", { name: error instanceof Error ? error.name : "unknown" });
    }
}

function capture(state: State, stage: Stage, reading: HeapForensicReading, withSnapshot: boolean): void {
    if (state.inFlight || state.captured.has(stage)) return;
    state.inFlight = true;
    state.captured.add(stage);
    const prefix = "heap-" + Date.now() + "-" + process.pid + "-" + stage;
    const finish = (profile: unknown, error?: string) => {
        try {
            secureWrite(join(state.directory, prefix + ".json"), {
                kind: "sampled-allocations", stage, timestamp: new Date().toISOString(),
                node: process.version, pid: process.pid, reading,
                heap_spaces: getHeapSpaceStatistics(), sampling_profile: profile,
                capture_error: error || null,
            });
            prune(state.directory);
            log("profile-saved", { stage, path: join(state.directory, prefix + ".json"), heap_mb: reading.heap_used_mb });
        } catch (saveError) {
            log("profile-failed", { stage, name: saveError instanceof Error ? saveError.name : "unknown" });
        } finally {
            if (withSnapshot) snapshot(state, reading, prefix);
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
            captured: new Set(), snapshotAttempted: false, lastSnapshotCheckAt: 0, directory: dir,
        };
        shared.__imenuHeapForensics = state;
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

/** Reuses the existing 60-second runtime metrics timer; no extra polling or GC. */
export function observeRuntimeHeapForensics(reading: HeapForensicReading): void {
    const state = shared.__imenuHeapForensics;
    if (!state?.ready) return;
    if (state.firstHeapMb === null) state.firstHeapMb = reading.heap_used_mb;
    const growth = reading.heap_used_mb - state.firstHeapMb;
    // If a prior attempt was safely skipped, retry while still below the snapshot ceiling.
    if (state.captured.has("growing") && !state.inFlight && !state.snapshotAttempted &&
        reading.heap_used_percent >= 43 && reading.heap_used_percent <= 55 && growth >= 96 &&
        Date.now() - state.lastSnapshotCheckAt >= 5 * 60_000) {
        snapshot(state, reading, "heap-" + Date.now() + "-" + process.pid + "-growing");
    }
    if (reading.heap_used_percent >= 85) {
        capture(state, "critical", reading, false);
    } else if (reading.heap_used_percent >= 70) {
        capture(state, "high", reading, false);
    } else if (reading.heap_used_percent >= 43 && growth >= 96) {
        capture(state, "growing", reading, true);
    } else if (reading.heap_used_percent >= 25 && growth >= 48) {
        capture(state, "baseline", reading, false);
    }
}
