import { NextRequest } from "next/server";
import { PATCH, PUT } from "./route";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { query } from "@/lib/database/sql";
import { DEFAULT_WHATSAPP_MESSAGE_TEMPLATES } from "@/lib/services/whatsappMessageTemplates";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/addons/access", () => ({ hasIMenuPlusAccess: jest.fn() }));
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

it("requires Plus before enabling AI", async () => {
    jest.clearAllMocks();
    (hasIMenuPlusAccess as jest.Mock).mockResolvedValue(false);
    const response = await PATCH(new NextRequest("http://localhost/api/whatsapp/settings?restaurantId=restaurant", {
        method: "PATCH", body: JSON.stringify({ aiEnabled: true }),
    }));
    expect(response.status).toBe(402);
    expect(query).not.toHaveBeenCalled();
});

it.each([true, false])("saves AI=%s without replacing independent settings", async (enabled) => {
    jest.clearAllMocks();
    (hasIMenuPlusAccess as jest.Mock).mockResolvedValue(true);
    (query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 1 });
    const response = await PATCH(new NextRequest("http://localhost/api/whatsapp/settings?restaurantId=restaurant", {
        method: "PATCH", body: JSON.stringify({ aiEnabled: enabled }),
    }));
    expect(response.status).toBe(200);
    const [sql, parameters] = (query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/COALESCE\(whatsapp_bot_settings.automations.*\|\|/s);
    expect(parameters).toEqual(["restaurant", JSON.stringify({ ai_enabled: enabled })]);
});

