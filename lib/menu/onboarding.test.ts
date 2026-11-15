import type { PoolClient } from "pg";
import { MENU_EXAMPLE_IMAGES } from "./itemImages";
import { seedEmptyMenuExample } from "./onboarding";
import { seedPizzaExample } from "@/lib/pizza/onboarding";

const makeClient = (query: jest.Mock) => ({ query } as Pick<PoolClient, "query">);

test("seeds one available illustrated Coca-Cola in a new drinks category", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: "created-category" }] }).mockResolvedValue({ rows: [] });

    await seedEmptyMenuExample(makeClient(query), "restaurant");

    expect(query).toHaveBeenCalledTimes(4);
    expect(query).toHaveBeenNthCalledWith(3, expect.stringContaining("INSERT INTO public.categories"), ["restaurant", "Bebidas"]);
    expect(query).toHaveBeenNthCalledWith(4, expect.stringContaining("$5, $6, TRUE, 0"), [
        "restaurant", "created-category", "Coca-Cola 350 ml", "Coca-Cola Original em lata de 350 ml.", 600, MENU_EXAMPLE_IMAGES.cola,
    ]);
});

test("reuses an existing drinks category", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: "drinks" }] })
        .mockResolvedValueOnce({ rows: [] });

    await seedEmptyMenuExample(makeClient(query), "restaurant");

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[2][1][1]).toBe("drinks");
});

test("leaves a populated menu alone, including an unavailable product", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ exists: 1 }] });

    await seedEmptyMenuExample(makeClient(query), "restaurant");

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).not.toContain("is_available");
});

test.each([
    { items: [], expectedAvailability: true },
    { items: [{ is_available: false }, { is_available: null }], expectedAvailability: true },
    { items: [{ is_available: false }, { is_available: true }], expectedAvailability: false },
])("the pizza example is active only without other active items (%#) and prevents a fallback drink", async ({ items, expectedAvailability }) => {
    const query = jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: items.map(item => ({ ...item, name: "Produto", category_id: "other-category" })) })
        .mockResolvedValueOnce({ rows: [{ id: "pizza-category" }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: "pizza" }] })
        .mockResolvedValueOnce({ rows: [{ id: "size", name: "Tamanho" }, { id: "crust", name: "Borda" }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ exists: 1 }] });
    const client = makeClient(query);

    await seedPizzaExample(client, "restaurant", "Pizzaria do Bairro", null);
    await seedEmptyMenuExample(client, "restaurant");

    expect(query).toHaveBeenCalledTimes(10);
    expect(query).toHaveBeenNthCalledWith(5, expect.stringContaining("3000, $5, $6, 0"), [
        "restaurant", "pizza-category", "Pizza de Exemplo", "Escolha o tamanho e a borda da pizza.", MENU_EXAMPLE_IMAGES.pizza, expectedAvailability,
    ]);
});
