import { hasQrTableAccess, resolveQrTableAddon } from "./types";

const now = Date.parse("2026-10-23T18:00:00Z");
const plus = { product_key: "ia_plus" as const, status: "active", current_period_ends_at: null, universal_token: "plus-token" };

test("Plus-only subscriptions unlock QR immediately using their existing token", () => {
    expect(resolveQrTableAddon([plus], now)).toMatchObject({ universal_token: "plus-token", included_in_plus: true });
    expect(hasQrTableAccess(resolveQrTableAddon([plus], now), now)).toBe(true);
});

test("bundling retains previously printed QR tokens even when the QR-only period expired", () => {
    const qr = { product_key: "qr_code_mesa" as const, status: "inactive", current_period_ends_at: null, universal_token: "printed-token" };
    const addon = resolveQrTableAddon([qr, plus], now);
    expect(addon).toMatchObject({ universal_token: "printed-token", status: "active", included_in_plus: true });
    expect(hasQrTableAccess(addon, now)).toBe(true);
});

test.each(["canceled", "past_due"])("Plus %s retains bundled QR through the paid period", (status) => {
    expect(hasQrTableAccess(resolveQrTableAddon([{ ...plus, status, current_period_ends_at: "2026-11-01T00:00:00Z" }], now), now)).toBe(true);
    expect(resolveQrTableAddon([{ ...plus, status, current_period_ends_at: "2026-10-01T00:00:00Z" }], now)).toBeNull();
});

test.each(["inactive", "pending"])("%s Plus cannot unlock QR", (status) => {
    expect(resolveQrTableAddon([{ ...plus, status }], now)).toBeNull();
});

test("losing Plus preserves an independently active QR subscription", () => {
    const qr = { product_key: "qr_code_mesa" as const, status: "active", current_period_ends_at: null };
    const addon = resolveQrTableAddon([qr, { ...plus, status: "inactive" }], now);
    expect(addon?.included_in_plus).toBe(false);
    expect(hasQrTableAccess(addon, now)).toBe(true);
});
