import { arePizzaFlavorsCompatible, prepareScannedPizza } from "./scannedPizza";

describe("prepareScannedPizza", () => {
    it("creates per-flavor size price differences and optional crust charges", () => {
        expect(prepareScannedPizza({
            is_pizza_flavor: true,
            price_cents: null,
            pizza_sizes: [
                { name: "Grande", price_cents: 6000 },
                { name: "Pequena", price_cents: 4000 },
            ],
            pizza_crusts: [{ name: "Catupiry", price_cents: 800 }],
        })).toEqual({
            price_cents: 4000,
            complements: [
                { name: "Tamanho", min_select: 1, max_select: 1, options: [
                    { name: "Grande", price_cents: 2000 },
                    { name: "Pequena", price_cents: 0 },
                ] },
                { name: "Borda", min_select: 0, max_select: 1, options: [
                    { name: "Catupiry", price_cents: 800 },
                ] },
            ],
        });
    });

    it("never interprets menu options as pizza complements for other products", () => {
        expect(prepareScannedPizza({ is_pizza_flavor: false, price_cents: 2500,
            pizza_sizes: [{ name: "Grande", price_cents: 3500 }] }))
            .toEqual({ price_cents: 2500, complements: [] });
    });

    it("does not invent prices for unreadable sizes", () => {
        expect(prepareScannedPizza({ is_pizza_flavor: true, price_cents: 4500,
            pizza_sizes: [{ name: "Pequena", price_cents: 4500 }, { name: "Grande", price_cents: null }] }))
            .toEqual({ price_cents: 4500, complements: [] });
    });

    it("deduplicates crust labels without fabricating a no-crust option", () => {
        expect(prepareScannedPizza({ is_pizza_flavor: true, price_cents: 3500,
            pizza_crusts: [{ name: "Catupiry", price_cents: 700 }, { name: "catupíry", price_cents: 700 }] }))
            .toEqual({ price_cents: 3500, complements: [
                { name: "Borda", min_select: 0, max_select: 1, options: [{ name: "Catupiry", price_cents: 700 }] },
            ] });
    });
});

describe("arePizzaFlavorsCompatible", () => {
    it("allows different prices when the options match", () => {
        const first = { is_pizza_flavor: true, price_cents: 3500, pizza_sizes: [
            { name: "Pequena", price_cents: 3500 }, { name: "Grande", price_cents: 5500 },
        ] };
        const second = { is_pizza_flavor: true, price_cents: 4000, pizza_sizes: [
            { name: "Pequena", price_cents: 4000 }, { name: "Grande", price_cents: 6000 },
        ] };
        expect(arePizzaFlavorsCompatible([first, second])).toBe(true);
    });

    it("rejects unmatched selection groups that would break half-and-half checkout", () => {
        expect(arePizzaFlavorsCompatible([
            { is_pizza_flavor: true, price_cents: 3500, pizza_sizes: [
                { name: "Pequena", price_cents: 3500 }, { name: "Grande", price_cents: 5500 },
            ] },
            { is_pizza_flavor: true, price_cents: 4000 },
        ])).toBe(false);
    });
});
