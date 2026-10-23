import { shouldAutomaticallyRestartWahaSession } from "./whatsappPairingCleanup";

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
