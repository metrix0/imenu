import { collectionBounds, featureCode, geometryBounds, geometryPath, integer, money, decimal, type GeoFeature } from "../cannonnadeMap";

describe("Cannonnade geometry helpers", () => {
    const square: GeoFeature = {
        type: "Feature",
        properties: { code: "123", name: "Cidade" },
        geometry: { type: "Polygon", coordinates: [[[1, 2], [3, 2], [3, 4], [1, 2]]] },
    };

    it("preserves coordinate inversion, bounds and path", () => {
        expect(featureCode(square)).toBe("123");
        expect(geometryBounds(square.geometry)).toEqual({ x: 1, y: -4, width: 2, height: 2 });
        expect(geometryPath(square.geometry)).toBe("M 1 -2 L 3 -2 L 3 -4 L 1 -2 Z");
    });

    it("keeps map padding and empty defaults", () => {
        expect(collectionBounds([])).toEqual({ x: 0, y: 0, width: 1, height: 1 });
        const value = collectionBounds([square]);
        expect(value.width).toBeGreaterThan(2);
        expect(value.height).toBeGreaterThan(2);
    });

    it("preserves user-facing units", () => {
        expect(integer(1234)).toBe("1.234");
        expect(money(1250)).toContain("12,50");
        expect(decimal(1.5)).toBe("1,50");
    });
});
