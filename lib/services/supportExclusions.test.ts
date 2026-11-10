import { createHash } from "node:crypto";
import { query } from "@/lib/database/sql";
import { isSupportContactExcluded, supportExclusionHashes } from "./supportExclusions";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

beforeEach(() => jest.clearAllMocks());

test("matches a phone, national form and WAHA LID without storing plaintext", () => {
    const phoneHash = sha("phone:5511988576886");
    expect(supportExclusionHashes({ phone: "+55 11 98857-6886" })).toContain(phoneHash);
    expect(supportExclusionHashes({ chatId: "5511988576886@c.us" })).toContain(phoneHash);
    expect(supportExclusionHashes({ chatId: "imenu-blast:99389989204047@lid" }))
        .toContain(sha("chat:99389989204047@lid"));
    expect(supportExclusionHashes({ phone: "11 8857-6886" })).toContain(phoneHash);
});

test("checks the database exclusion list without sending any WAHA message", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [{ value: 1 }], rowCount: 1 });
    await expect(isSupportContactExcluded({ phone: "5511988576886" })).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(
        expect.stringContaining("FROM support_contact_exclusions"),
        [[sha("phone:5511988576886")]]
    );
});

test("other contacts are unaffected; missing identifiers perform no query", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(isSupportContactExcluded({ chatId: "5511999991234@c.us" })).resolves.toBe(false);
    await expect(isSupportContactExcluded({})).resolves.toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
});
