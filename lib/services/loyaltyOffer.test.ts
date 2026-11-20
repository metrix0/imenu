import { query } from "@/lib/database/sql";
import { loadLoyaltyOffer } from "./loyaltyOffer";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));

const database = jest.mocked(query);

beforeEach(() => database.mockReset());

it.each([false, true])("keeps the program visible when a linked reward is unavailable (missing=%s)", async (missing) => {
    database.mockResolvedValueOnce({ rows: [{
        active: true, goal_count: 10, min_order_value_cents: 0, reward_item_id: "main",
        additional_rewards: [{ item_id: "extra", subitem_ids: [] }],
    }] } as never);
    database.mockResolvedValueOnce({ rows: [
        { id: "main", name: "Item principal", is_available: true },
        ...(missing ? [] : [{ id: "extra", name: "Item extra", is_available: false }]),
    ] } as never);
    database.mockResolvedValueOnce({ rows: [] } as never);

    const offer = await loadLoyaltyOffer("store");
    expect(offer?.active).toBe(true);
    expect(offer?.reward_unavailable).toBe(true);
    expect(offer?.rewards.map(reward => reward.id)).toEqual(missing ? ["main"] : ["main", "extra"]);
});

it("keeps a switched-on draft private until a reward is configured", async () => {
    database.mockResolvedValueOnce({ rows: [{ active: true, reward_item_id: null }] } as never);
    await expect(loadLoyaltyOffer("store")).resolves.toBeNull();
    expect(database).toHaveBeenCalledTimes(1);
});

it("keeps a saved goal of zero private even when the reward is set", async () => {
    database.mockResolvedValueOnce({ rows: [{ active: true, goal_count: 0, reward_item_id: "main" }] } as never);
    await expect(loadLoyaltyOffer("store")).resolves.toBeNull();
    expect(database).toHaveBeenCalledTimes(1);
});
