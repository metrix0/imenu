import { CAPTURE_COOLDOWN_MS, captureStage, requestGroup, type HeapForensicReading, type Stage } from "../runtimeHeapForensics";

const reading: HeapForensicReading = {
    heap_used_mb: 440, heap_limit_mb: 1000, rss_mb: 550, heap_used_percent: 44,
};

describe("runtime heap evidence thresholds", () => {
    it("keeps the baseline and growth thresholds without a snapshot", () => {
        expect(captureStage({ ...reading, heap_used_percent: 25 }, 48, new Set())).toBe("baseline");
        expect(captureStage(reading, 96, new Set())).toBe("growing");
        expect(captureStage(reading, 95, new Set())).toBe("baseline");
        expect(captureStage(reading, 47, new Set())).toBeNull();
    });
    it("records high and critical levels once per process", () => {
        expect(captureStage({ ...reading, heap_used_percent: 72 }, 0, new Set())).toBe("high");
        expect(captureStage({ ...reading, heap_used_percent: 90 }, 0, new Set())).toBe("critical");
        expect(captureStage({ ...reading, heap_used_percent: 90 }, 110,
            new Set<Stage>(["critical", "high", "growing", "baseline"]))).toBeNull();
    });
    it("cooldowns all stages for five minutes without permanently skipping high severity", () => {
        const at = 1000000;
        expect(captureStage({ ...reading, heap_used_percent: 85 }, 110, new Set<Stage>(["growing"]), at, at + 60_000)).toBeNull();
        expect(captureStage({ ...reading, heap_used_percent: 85 }, 110, new Set<Stage>(["growing"]), at, at + CAPTURE_COOLDOWN_MS)).toBe("critical");
    });
    it("does not cascade into lower stages after a higher capture", () => {
        expect(captureStage({ ...reading, heap_used_percent: 85 }, 110, new Set<Stage>(["critical"]))).toBeNull();
    });
    it("does not repeat a saved stage", () => {
        expect(captureStage(reading, 110, new Set<Stage>(["baseline", "growing"]))).toBeNull();
    });
});

describe("private HTTP activity aggregation", () => {
    it("groups endpoints without storing query strings, order IDs or restaurant slugs", () => {
        expect(requestGroup("/api/orders/123456/status-order?token=secret")).toBe("/api/orders");
        expect(requestGroup("/api/printer?key=secret")).toBe("/api/printer");
        expect(requestGroup("/pizzaria-some-name?secret=1")).toBe("/pages");
        expect(requestGroup("/")).toBe("/");
    });
    it("does not retain arbitrary API path segments", () => {
        expect(requestGroup("/api/verySensitiveRestaurantNameWithUniqueId/test")).toBe("/api/other");
        expect(requestGroup("/api/abc-123/test")).toBe("/api/other");
    });
});
