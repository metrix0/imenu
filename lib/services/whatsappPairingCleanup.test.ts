import { shouldAutomaticallyRestartWahaSession, shouldCleanupStaleWhatsAppConnection } from "./whatsappPairingCleanup";

describe("WAHA automatic restart backoff", () => {
    const now = Date.parse("2026-10-23T20:00:00Z");

    test("allows first restart when no prior restart exists", () => {
        expect(shouldAutomaticallyRestartWahaSession(null, 0, now)).toBe(true);
    });
    test("delays a retry just after a manual reconnect", () => {
        expect(shouldAutomaticallyRestartWahaSession(new Date(now - 30_000).toISOString(), 0, now)).toBe(false);
        expect(shouldAutomaticallyRestartWahaSession(new Date(now - 60_000).toISOString(), 0, now)).toBe(true);
    });
    test.each([[1, 5], [2, 15], [3, 60], [4, 360], [5, 720], [100, 720]])(
        "waits for cooldown after %i prior restarts", (attempts, minutes) => {
            expect(shouldAutomaticallyRestartWahaSession(new Date(now - minutes * 60_000 + 1).toISOString(), attempts, now)).toBe(false);
            expect(shouldAutomaticallyRestartWahaSession(new Date(now - minutes * 60_000).toISOString(), attempts, now)).toBe(true);
        }
    );
    test("rejects an invalid timestamp", () => {
        expect(shouldAutomaticallyRestartWahaSession("invalid", 3, now)).toBe(false);
    });
});

describe("WAHA stale session cleanup eligibility", () => {
    const now = Date.parse("2026-10-29T12:00:00Z");
    const stale = new Date(now - 6 * 86400_000).toISOString();
    const recent = new Date(now - 60_000).toISOString();
    const base = {
        restaurant_id: "test", session_name: "test",
        desired_state: "connected", status: "FAILED",
        pairing_started_at: null, last_disconnected_at: stale,
        updated_at: stale,
    };
    test("uses last disconnect time for previously working failed sessions", () => {
        expect(shouldCleanupStaleWhatsAppConnection(base, now)).toBe(true);
    });
    test("never cleans a working session", () => {
        expect(shouldCleanupStaleWhatsAppConnection({ ...base, status: "WORKING" }, now)).toBe(false);
    });
    test("preserves recent failures and active pairing", () => {
        expect(shouldCleanupStaleWhatsAppConnection({ ...base, last_disconnected_at: recent }, now)).toBe(false);
        expect(shouldCleanupStaleWhatsAppConnection({ ...base, pairing_started_at: recent }, now)).toBe(false);
    });
    test("reconciles disconnected sessions only after settling", () => {
        expect(shouldCleanupStaleWhatsAppConnection({ ...base, desired_state: "disconnected", status: "STOPPED", updated_at: stale }, now)).toBe(true);
        expect(shouldCleanupStaleWhatsAppConnection({ ...base, desired_state: "disconnected", status: "STOPPED", updated_at: recent }, now)).toBe(false);
    });
});
