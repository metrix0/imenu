import { useLoyaltyStore } from "./loyaltyStore";
import type { LoyaltyProgram } from "@/lib/types/types";

const draft: LoyaltyProgram = {
    id: "program", restaurant_id: "restaurant", active: true, goal_count: 10,
    reward_description: "Reward", reward_item_id: "item", reward_subitem_ids: [], min_order_value_cents: 0,
};

describe("loyalty autosave snapshots", () => {
    const originalFetch = global.fetch;
    afterEach(() => {
        global.fetch = originalFetch;
        useLoyaltyStore.setState({ program: null, loading: false });
    });

    it("does not replace an edit made while the previous draft was saving", async () => {
        let finish!: (response: Response) => void;
        global.fetch = jest.fn(() => new Promise<Response>((resolve) => { finish = resolve; })) as typeof fetch;
        useLoyaltyStore.getState().setProgram(draft);
        const saving = useLoyaltyStore.getState().saveProgram(draft);
        useLoyaltyStore.getState().updateField("goal_count", 20);
        finish(Response.json({ ...draft, updated_at: "server timestamp" }));
        expect(await saving).toBe(true);
        expect(useLoyaltyStore.getState().program?.goal_count).toBe(20);
        expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).goal_count).toBe(10);
    });

    it("adopts the server result when the saved draft is still current", async () => {
        global.fetch = jest.fn().mockResolvedValue(Response.json({ ...draft, id: "saved-id" }));
        useLoyaltyStore.getState().setProgram(draft);
        expect(await useLoyaltyStore.getState().saveProgram(draft)).toBe(true);
        expect(useLoyaltyStore.getState().program?.id).toBe("saved-id");
    });

    it("ignores a slow load belonging to a previously selected restaurant", async () => {
        let finish!: (response: Response) => void;
        global.fetch = jest.fn()
            .mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }))
            .mockResolvedValueOnce(Response.json({ ...draft, restaurant_id: "new-restaurant" }));
        const oldLoad = useLoyaltyStore.getState().fetchProgram("old-restaurant");
        expect(await useLoyaltyStore.getState().fetchProgram("new-restaurant")).toBe(true);
        finish(Response.json({ ...draft, restaurant_id: "old-restaurant" }));
        expect(await oldLoad).toBe(false);
        expect(useLoyaltyStore.getState().program?.restaurant_id).toBe("new-restaurant");
    });
});
