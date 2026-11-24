/** @jest-environment node */
import { gzipSync } from "node:zlib";
import { unzipSync } from "fflate";
import { requireRestaurantOwner } from "@/lib/auth/restaurantOwner";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { query } from "@/lib/database/sql";
import { GET, POST } from "./route";

jest.mock("@/lib/auth/restaurantOwner", () => ({
    requireRestaurantOwner: jest.fn(),
    RestaurantOwnerAuthError: class extends Error {},
}));
jest.mock("@/lib/addons/access", () => ({ hasIMenuPlusAccess: jest.fn() }));
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));

const restaurant = "28169002-8044-4a77-bccf-bcf0e159bf1b";
const key = "1".repeat(44);
const request = (args: string) => new Request(`http://localhost/api/nfce?restaurantId=${restaurant}&${args}`);

const oldEnvironment = process.env.NFCE_ENV;
const oldKey = process.env.NFCE_KEY;
beforeEach(() => {
    process.env.NFCE_ENV = "homologacao";
    process.env.NFCE_KEY = "1".repeat(64);
});
afterEach(() => {
    if (oldEnvironment === undefined) delete process.env.NFCE_ENV;
    else process.env.NFCE_ENV = oldEnvironment;
    if (oldKey === undefined) delete process.env.NFCE_KEY;
    else process.env.NFCE_KEY = oldKey;
});

test("exports original XMLs and cancellation records for the selected São Paulo dates, including after Plus expires", async () => {
    jest.mocked(hasIMenuPlusAccess).mockResolvedValue(false);
    jest.mocked(query)
        .mockResolvedValueOnce({ rows: [{
            access_key: key, issued_at: "2026-11-07 20:00:00+00", authorized_xml: gzipSync("<nfeProc/>"), cancellation_xml: gzipSync("<procEventoNFe/>"),
        }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const response = await GET(request("action=zip&start=2026-11-01&end=2026-11-22"));
    expect(response.status).toBe(200);
    expect(requireRestaurantOwner).toHaveBeenCalledWith(expect.any(Request), restaurant);
    expect(jest.mocked(query).mock.calls[0][1]).toEqual([restaurant, 2, new Date("2026-11-01T03:00:00Z"), new Date("2026-11-23T03:00:00Z"), null, null]);
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(Buffer.from(files[`${key}-procNFe.xml`]).toString()).toBe("<nfeProc/>");
    expect(Buffer.from(files[`${key}-cancelamento.xml`]).toString()).toBe("<procEventoNFe/>");
});

test("exposes fiscal UI state to Plus owners without enabling fiscal operations", async () => {
    delete process.env.NFCE_ENV;
    jest.mocked(hasIMenuPlusAccess).mockResolvedValue(true);

    const history = await GET(request("action=list"));
    expect(await history.json()).toEqual({ available: false, plus: true, archive: false, configured: false, enabled: false, notes: [] });
    const settings = await GET(request("action=settings"));
    expect(await settings.json()).toEqual({ available: false, plus: true, environment: null, issuer: null, items: [] });
    expect((await GET(request("action=zip"))).status).toBe(503);
    expect((await POST(request("action=settings"))).status).toBe(403);
    expect(requireRestaurantOwner).toHaveBeenCalledWith(expect.any(Request), restaurant);
    expect(query).not.toHaveBeenCalled();
});

test("preserves the Plus entitlement check without fiscal runtime configuration", async () => {
    delete process.env.NFCE_KEY;
    jest.mocked(hasIMenuPlusAccess).mockResolvedValue(false);
    const history = await GET(request("action=list"));
    expect(await history.json()).toMatchObject({ available: false, plus: false });
    expect((await GET(request("action=settings"))).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
});


test("lists archived fiscal notes for the selected period, newest first and independently of order filters", async () => {
    jest.mocked(query).mockClear();
    jest.mocked(hasIMenuPlusAccess).mockResolvedValue(false);
    const notes = [{ order_id: restaurant, number: 10, series: 1, issued_at: "2026-11-07T20:00:00Z", status: "authorized" }];
    jest.mocked(query)
        .mockResolvedValueOnce({ rows: notes, rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total: 42 }], rowCount: 1 });
    const response = await GET(request("action=history&start=2026-11-01&end=2026-11-22&page=1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ notes, pageCount: 3 });
    expect(requireRestaurantOwner).toHaveBeenCalledWith(expect.any(Request), restaurant);
    expect(jest.mocked(query).mock.calls[0][0]).toContain("authorized_xml IS NOT NULL");
    expect(jest.mocked(query).mock.calls[0][0]).toContain("ORDER BY issued_at DESC,order_id DESC");
    expect(jest.mocked(query).mock.calls[0][1]).toEqual([restaurant, 2, new Date("2026-11-01T03:00:00Z"), new Date("2026-11-23T03:00:00Z"), 20, 20]);
});


test.each([[true, false], [false, false], [true, true]])("history exposes requested NFC-e toggle %s separately from readiness %s", async (enabled, configured) => {
    jest.mocked(query).mockReset();
    jest.mocked(hasIMenuPlusAccess).mockResolvedValue(true);
    jest.mocked(query)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ enabled: configured, requested_enabled: enabled }], rowCount: 1 });
    const response = await GET(request("action=list"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ plus: true, enabled, configured });
    expect(jest.mocked(query).mock.calls[1][0]).toContain("requestedEnabled");
});
