import { isLikelyPizzeria } from "./onboarding";

const category = { id: "pizza-cat", name: "Pizzas Tradicionais" };
const product = (name: string, category_id = "pizza-cat") => ({ name, category_id });

describe("pizzeria detection during onboarding", () => {
    it("recognizes an explicitly named pizzeria before products exist", () => {
        expect(isLikelyPizzeria("Pizzaria do Bairro", [], [])).toBe(true);
    });

    it("recognizes pizza categories with a meaningful group of products", () => {
        expect(isLikelyPizzeria("Delícias da Casa", [category], [
            product("Calabresa"), product("Portuguesa"), product("Mussarela"), product("Refrigerante", "drinks"),
        ])).toBe(true);
    });

    it("recognizes several explicitly named pizzas without a pizza category", () => {
        expect(isLikelyPizzeria("Varandas Rio Negro", [], [
            product("Pizza Calabresa", "geral"),
            product("Pizza Portuguesa", "geral"),
            product("Pizza Marguerita", "geral"),
        ])).toBe(true);
    });

    it("does not mistake calabresa in burger menus for a pizzeria", () => {
        expect(isLikelyPizzeria("Hamburgueria do Centro", [{ id: "burgers", name: "Hambúrgueres" }], [
            product("X-Calabresa", "burgers"), product("Calabresa", "burgers"),
            product("Mussarela", "burgers"), product("Portuguesa", "burgers"),
        ])).toBe(false);
    });

    it("ignores a single pizza in a wider menu", () => {
        expect(isLikelyPizzeria("Padaria", [{ id: "salgados", name: "Salgados" }], [
            product("Pizza Calabresa", "salgados"), product("Coxinha", "salgados"), product("Pão de Queijo", "salgados"),
        ])).toBe(false);
    });

    it("excludes specialty pizza-like products", () => {
        expect(isLikelyPizzeria("Kim Nam Sushi", [{ id: "sushi", name: "Sushi Pizza" }], [
            product("Sushi Pizza Camarão", "sushi"), product("Sushi Pizza Salmão", "sushi"),
            product("Sushi Pizza Doritos", "sushi"),
        ])).toBe(false);
        expect(isLikelyPizzeria("Confeitaria", [{ id: "brownie", name: "Pizza Brownie" }], [
            product("Pizza Brownie Kinder", "brownie"), product("Pizza Brownie Brigadeiro", "brownie"),
            product("Pizza Brownie Ferrero", "brownie"),
        ])).toBe(false);
        expect(isLikelyPizzeria("Salgados", [{ id: "mini", name: "Mini Pizzas" }], [
            product("Mini Pizza Calabresa", "mini"), product("Mini Pizza Frango", "mini"),
            product("Mini Pizza Portuguesa", "mini"),
        ])).toBe(false);
    });
});
