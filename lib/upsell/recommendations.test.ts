import { rankAutomaticUpsells } from "./recommendations";

describe("rankAutomaticUpsells", () => {
  const cached = {
    items: [{ source: "pizza", target: "soda", orders: 5 }, { source: "pizza", target: "dessert", orders: 2 }],
    categories: [{ source: "mains", target: "dessert", orders: 9 }],
    popular: [{ target: "fries", orders: 80 }, { target: "pizza", orders: 100 }]
  };
  test("prefers purchased-together products and categories over popularity", () => {
    expect(rankAutomaticUpsells(cached, ["pizza"], ["mains"], new Set(["pizza", "soda", "dessert", "fries"])))
      .toEqual(["soda", "dessert", "fries"]);
  });
  test("excludes already selected and unavailable items", () => {
    expect(rankAutomaticUpsells(cached, ["pizza", "soda"], ["mains"], new Set(["soda", "fries"]))).toEqual(["fries"]);
  });
  test("empty history yields no automatic upsells", () => {
    expect(rankAutomaticUpsells(null, ["pizza"], [], new Set(["soda"]))).toEqual([]);
  });
});
