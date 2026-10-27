import { NextRequest } from "next/server";
import { PUT } from "./route";
import { query } from "@/lib/database/sql";
import { DEFAULT_WHATSAPP_MESSAGE_TEMPLATES } from "@/lib/services/whatsappMessageTemplates";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/auth/restaurantOwner", () => ({
    requireRestaurantOwner: jest.fn().mockResolvedValue({ user: { id: "owner" } }),
    RestaurantOwnerAuthError: class extends Error {},
}));

it("restores default robot messages without deleting the row containing CRM automations", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 1 });
    const response = await PUT(new NextRequest("http://localhost/api/whatsapp/settings?restaurantId=restaurant", {
        method: "PUT",
        body: JSON.stringify({ templates: DEFAULT_WHATSAPP_MESSAGE_TEMPLATES }),
    }));
    expect(response.status).toBe(200);
    const [sql, parameters] = (query as jest.Mock).mock.calls[0];
    expect(sql).not.toMatch(/DELETE|automations\s*=/i);
    expect(sql).toMatch(/ON CONFLICT.*DO UPDATE SET\s+message_templates/s);
    expect(parameters).toEqual(["restaurant", "{}"]);
    expect((await response.json()).templates).toEqual(DEFAULT_WHATSAPP_MESSAGE_TEMPLATES);
});
