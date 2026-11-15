import { PATCH } from "./routeBase";
import { query, withTransaction } from "@/lib/database/sql";
import { seedPizzaExample } from "@/lib/pizza/onboarding";
import { getCreationStepPath, normalizeCreationStep } from "@/lib/restaurantCreation";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/lib/pizza/onboarding", () => ({ seedPizzaExample: jest.fn() }));
const context = { params: Promise.resolve({ id: "restaurant" }) };
const request = (body: unknown) => new Request("http://localhost/api/restaurants/restaurant", {
    method: "PATCH", body: JSON.stringify(body),
});
const row = { id: "restaurant", name: "Restaurante", url_slug: "restaurante", creation_step: 5, first_time: false };
const clientQuery = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    (query as jest.Mock).mockImplementation(async (sql: string) =>
        ({ rows: sql.startsWith("SELECT") ? [{ id: "restaurant", url_slug: "restaurante" }] : [row] }));
    clientQuery.mockImplementation(async (sql: string) =>
        ({ rows: sql.startsWith("SELECT") ? [{ first_time: true, name: "Restaurante", pizza_settings: null }] : [row] }));
    (withTransaction as jest.Mock).mockImplementation(async fn => fn({ query: clientQuery }));
});

test("step 5 resumes at Plus rather than restarting the menu", () => {
    expect(normalizeCreationStep(5)).toBe(5);
    expect(getCreationStepPath(5)).toBe("/restaurante/criar/plus");
    expect(normalizeCreationStep(6)).toBe(1);
});

test("advancing to Plus persists step 5 without completing registration or seeding", async () => {
    const response = await PATCH(request({ creation_step: 5 }), context);
    expect(response.status).toBe(200);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("creation_step = $2"), ["restaurant", 5]);
    expect(withTransaction).not.toHaveBeenCalled();
    expect(seedPizzaExample).not.toHaveBeenCalled();
    expect((query as jest.Mock).mock.calls.at(-1)![0]).not.toContain("onboarding_completed_at");
});

test.each([4, 5])("finishing step %s preserves first completion and seeds once", async step => {
    const response = await PATCH(request({ creation_step: step, first_time: false }), context);
    expect(response.status).toBe(200);
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(clientQuery.mock.calls[1][0]).toContain("CASE WHEN first_time IS DISTINCT FROM FALSE THEN NOW() ELSE onboarding_completed_at END");
    expect(seedPizzaExample).toHaveBeenCalledTimes(1);
    expect(clientQuery.mock.calls[1][1]).toEqual(["restaurant", step, false]);
});

test("repeated completion keeps the original completion date and does not reseed", async () => {
    clientQuery.mockImplementation(async (sql: string) =>
        ({ rows: sql.startsWith("SELECT") ? [{ first_time: false }] : [row] }));
    expect((await PATCH(request({ creation_step: 5, first_time: false }), context)).status).toBe(200);
    expect(seedPizzaExample).not.toHaveBeenCalled();
});

test("completing onboarding gives an unnamed restaurant a unique public link", async () => {
    clientQuery
        .mockResolvedValueOnce({ rows: [{ first_time: true, name: null, pizza_settings: null }] })
        .mockResolvedValueOnce({ rows: [{ ...row, name: null, url_slug: null }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...row, name: "Sem Nome", url_slug: "sem-nome" }] });

    const response = await PATCH(request({ creation_step: 5, first_time: false }), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ url_slug: "sem-nome" });
    expect(clientQuery.mock.calls[2][1]).toEqual(["sem-nome", "restaurant"]);
    expect(clientQuery.mock.calls[3][1]).toEqual(["restaurant", "Sem Nome", "sem-nome"]);
});
