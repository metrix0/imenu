import { hasQrTableAccess } from "./types";

test("legacy QR subscriptions remain usable for free regardless of paid status", () => {
    for (const status of ["inactive", "pending", "canceled", "past_due", "active"]) {
        expect(hasQrTableAccess({
            product_key: "qr_code_mesa",
            status,
            current_period_ends_at: null,
        })).toBe(true);
    }
});

test("Plus remains paid: missing, inactive and expired entitlements stay blocked", () => {
    const past = "2025-01-01T00:00:00Z";
    expect(hasQrTableAccess(null)).toBe(false);
    expect(hasQrTableAccess({ status: "pending", current_period_ends_at: null })).toBe(false);
    expect(hasQrTableAccess({ status: "canceled", current_period_ends_at: past })).toBe(false);
    expect(hasQrTableAccess({ status: "active", current_period_ends_at: null })).toBe(true);
});

test("legacy universal QR metadata survives expired Plus without a QR subscription", () => {
    const { resolveQrTableAddon } = require("./types");
    const legacy = { product_key: "ia_plus", status: "canceled", current_period_ends_at: "2020-01-01T00:00:00Z", universal_token: "printed" };
    expect(resolveQrTableAddon([legacy])).toMatchObject({ universal_token: "printed", included_in_plus: false });
});
