import { snapshotSafety, type HeapForensicReading } from "../runtimeHeapForensics";

const GIB = 1024 ** 3;
const reading: HeapForensicReading = {
    heap_used_mb: 440, heap_limit_mb: 1000, rss_mb: 550, heap_used_percent: 44,
};

describe("runtime heap evidence safety", () => {
    it("permits one early snapshot with comfortable cgroup and disk headroom", () => {
        expect(snapshotSafety(reading, 500 * 1024 ** 2, 2 * GIB, 10 * GIB)).toBeNull();
    });
    it("skips expensive snapshots above the safe heap threshold", () => {
        expect(snapshotSafety({ ...reading, heap_used_percent: 56 }, 500 * 1024 ** 2, 2 * GIB, 10 * GIB))
            .toBe("heap-already-too-high");
    });
    it("requires a known container memory limit", () => {
        expect(snapshotSafety(reading, null, null, 10 * GIB)).toBe("no-container-memory-limit");
    });
    it("protects the application when cgroup headroom is insufficient", () => {
        expect(snapshotSafety(reading, 1.4 * GIB, 2 * GIB, 10 * GIB))
            .toBe("insufficient-container-headroom");
    });
    it("protects VPS disk capacity", () => {
        expect(snapshotSafety(reading, 500 * 1024 ** 2, 2 * GIB, 3 * GIB))
            .toBe("insufficient-free-disk");
    });
});
