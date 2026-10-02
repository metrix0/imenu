import { potential } from "../peers";

describe("potential", () => {
  const sales = {
    orders: 100,
    revenue_cents: 1_000_000,
    ticket_cents: 10_000,
    days: 28,
  };

  test("combines common-sense ranges and does not sum the same overlap group twice", () => {
    const result = potential(sales, {
      days: 28,
      assumptions: "Cenários baseados nas vendas observadas.",
      opportunities: [
        {
          label: "Bebidas no carrinho",
          kind: "cart_addon",
          eligible_orders: 40,
          extra_cents: 600,
          overlap_group: "cart",
        },
        {
          label: "Kits mais claros",
          kind: "menu_clarity",
          eligible_revenue_cents: 100_000,
          overlap_group: "menu",
        },
        {
          label: "Combos mais visíveis",
          kind: "proven_combo_visibility",
          eligible_revenue_cents: 200_000,
          overlap_group: "menu",
        },
      ],
    });

    expect(result).toMatchObject({
      available: true,
      min_cents: 8_400,
      max_cents: 20_800,
      min_percent: 0.0084,
      max_percent: 0.0208,
    });
    expect(result.breakdown).toHaveLength(3);
    expect(result.breakdown[0].basis).toContain("10%–20%");
    expect(result.breakdown[1].basis).toContain("2%–5%");
    expect(result.breakdown[2].basis).toContain("3%–8%");
  });

  test("keeps the combined upside inside the existing 15% revenue cap", () => {
    const result = potential(sales, {
      days: 28,
      assumptions: "",
      opportunities: [
        {
          label: "Combos",
          kind: "proven_combo_visibility",
          eligible_revenue_cents: 1_000_000,
          overlap_group: "combos",
        },
        {
          label: "Kits",
          kind: "menu_clarity",
          eligible_revenue_cents: 1_000_000,
          overlap_group: "kits",
        },
        {
          label: "Adicionais",
          kind: "cart_addon",
          eligible_orders: 100,
          extra_cents: 10_000,
          overlap_group: "cart",
        },
      ],
    });

    expect(result.max_cents).toBe(150_000);
    expect(result.max_percent).toBe(0.15);
  });
});
