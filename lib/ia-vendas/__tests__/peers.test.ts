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
    expect(result.breakdown?.[0]?.basis).toContain("10%–20%");
    expect(result.breakdown?.[1]?.basis).toContain("2%–5%");
    expect(result.breakdown?.[2]?.basis).toContain("3%–8%");
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

  test("formats scenario assumptions in Brazilian Portuguese without changing the calculation", () => {
    const result = potential(sales, {
      days: 28, eligible_orders: 48, adoption_rate: 0.1,
      extra_cents: 600, assumptions: "",
    });
    expect(result.cents).toBe(2880);
    expect(result.formula).toContain("10%");
    expect(result.formula?.replace(/\s/g, " ")).toContain("R$ 6,00");
    expect(result.formula).not.toContain("10.0%");
  });

  test("derives eligible revenue from observed product IDs and counts repeated enhancements once", () => {
    const observed = { ...sales, products: [{ item_id: "p", gross_cents: 100_000 }] };
    const result = potential(observed, { opportunities: [
      { kind: "menu_clarity", item_ids: ["p", "p"], eligible_revenue_cents: 999999, overlap_group: "copy" },
      { kind: "menu_clarity", item_ids: ["p"], overlap_group: "photo" },
    ] });
    expect(result).toMatchObject({ min_cents: 2000, max_cents: 5000 });
    expect(result.breakdown?.[1]).toMatchObject({ min_cents: 0, max_cents: 0 });
  });

  test.each([false, true])("combos keep their existing range without an additional product clarity gain (reverse=%s)", (reverse) => {
    const opportunities = [
      { kind: "menu_clarity", item_ids: ["combo", "item"], overlap_group: "copy" },
      { kind: "proven_combo_visibility", item_ids: ["combo"], overlap_group: "combo" },
    ];
    const result = potential({ ...sales, products: [{ item_id: "combo", gross_cents: 200000 }, { item_id: "item", gross_cents: 100000 }] }, { opportunities: reverse ? opportunities.reverse() : opportunities });
    expect(result).toMatchObject({ min_cents: 8000, max_cents: 21000 });
  });

  test("rejects foreign, unavailable and out-of-stock products in presentation revenue", () => {
    const observed = { ...sales, products: [{ item_id: "p", gross_cents: 100000 }] };
    const input = { opportunities: [{ kind: "menu_clarity", item_ids: ["p"] }] };
    for (const items of [[], [{ id: "p", is_available: false }], [{ id: "p", stock_enabled: true, stock_quantity: 0 }]])
      expect(() => potential(observed, input, items)).toThrow("disponíveis");
    expect(() => potential(observed, { opportunities: [{ kind: "menu_clarity", item_ids: ["foreign"] }] })).toThrow("observadas");
    expect(() => potential(observed, input, [{ id: "p" }])).not.toThrow();
  });

  // Synthetic cohorts matching the approved manual totals. Cart parameters are
  // illustrative; the aggregate bases and joint 2%–5% calculation are pinned.
  test.each([
    ["Kim Nam", 871300, 414, 600, 272100, 50429, 115013],
    ["Tentações", 1044750, 215, 600, 0, 33795, 78038],
    ["Bistro", 689900, 213, 500, 0, 24448, 55795],
    ["Sandubão", 649350, 240, 600, 0, 27387, 61268],
  ])("reproduces the approved manual projection for %s", (_name, cohort, orders, extra, combo, min, max) => {
    const opportunities = [
      { kind: "cart_addon", eligible_orders: orders, extra_cents: extra, overlap_group: "cart" },
      { kind: "menu_clarity", item_ids: ["presentation-cohort"], overlap_group: "presentation" },
      ...(combo ? [{ kind: "proven_combo_visibility", item_ids: ["combo-cohort"], overlap_group: "combos" }] : []),
    ];
    const result = potential({ ...sales, orders: 500, revenue_cents: 3000000, products: [
      { item_id: "presentation-cohort", gross_cents: cohort },
      { item_id: "combo-cohort", gross_cents: combo },
    ] }, { opportunities });
    expect(result).toMatchObject({ min_cents: min, max_cents: max });
  });
});
