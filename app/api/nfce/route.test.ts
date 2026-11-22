/** @jest-environment node */
import { gzipSync } from "node:zlib";
import { unzipSync } from "fflate";
import { requireRestaurantOwner } from "@/lib/auth/restaurantOwner";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { query } from "@/lib/database/sql";
import { GET } from "./route";

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

test("does not query account data or contact a fiscal provider while disabled", async () => {
    delete process.env.NFCE_ENV;
    const response = await GET(request("action=list"));
    expect(await response.json()).toEqual({ available: false, notes: [], issuer: null });
    expect(requireRestaurantOwner).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
});
