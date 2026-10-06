import { buildProductOverview } from "../productOverview";

describe("product overview", () => {
    const views = { imenu: 100, ia_plus: 40, qr_code_mesa: 20 };
    it("uses total pageviews, with separate activation and paid acquisition numerators", () => {
        const result = buildProductOverview(views, 5, { count: 2, base: 10 }, [
            { product_key: "ia_plus", buyers: "2", churn_base: "4", churned_users: "1" },
            { product_key: "qr_code_mesa", buyers: 3, churn_base: 2, churned_users: 0 },
        ]);
        expect(result.imenu.conversion).toBe(5);
        expect(result.imenu.churn).toBe(20);
        expect(result.ia_plus).toMatchObject({ buyers: 2, conversion: 5, churn: 25 });
        expect(result.qr_code_mesa).toMatchObject({ buyers: 3, conversion: 15, churn: 0 });
    });
    it("keeps purchases and churn visible when traffic is unavailable", () => {
        const result = buildProductOverview({ imenu: null, ia_plus: null, qr_code_mesa: null }, 3,
            { count: 1, base: 2 }, [{ product_key: "ia_plus", buyers: 2, churn_base: 5, churned_users: 1 }]);
        expect(result.ia_plus).toMatchObject({ pageViews: null, buyers: 2, conversion: null, churn: 20 });
        expect(result.imenu.conversion).toBeNull();
    });
    it("does not report a misleading zero rate without a denominator", () => {
        const result = buildProductOverview({ imenu: 0, ia_plus: 0, qr_code_mesa: 0 }, 0,
            { count: 0, base: 0 }, []);
        for (const metric of Object.values(result)) {
            expect(metric.conversion).toBeNull();
            expect(metric.churn).toBeNull();
        }
    });
    it("distinguishes an observed zero conversion from missing traffic", () => {
        const result = buildProductOverview(views, 0, { count: 0, base: 1 }, []);
        expect(result.imenu.conversion).toBe(0);
        expect(result.imenu.churn).toBe(0);
        expect(result.ia_plus.conversion).toBe(0);
    });
    it("uses the existing Mesas and IA tab counts when no panel pageviews were recorded", () => {
        const result = buildProductOverview({ imenu: 0, ia_plus: 0, qr_code_mesa: 0 }, 0,
            { count: 0, base: 0 }, [{ product_key: "qr_code_mesa", buyers: 2, churn_base: 0, churned_users: 0 }],
            { available: true, tabs: [
                { tab: "Mesas", opens: 20 },
                { tab: "Assistente IA", opens: 5 },
                { tab: "Vendas IA", opens: 7 },
                { tab: "Pedidos", opens: 100 },
            ] });
        expect(result.qr_code_mesa).toMatchObject({ pageViews: 20, trafficSource: "tab_opens", conversion: 10 });
        expect(result.ia_plus).toMatchObject({ pageViews: 12, trafficSource: "tab_opens" });
        expect(result.imenu).toMatchObject({ pageViews: 0, trafficSource: "pageviews", conversion: null });
    });
    it("prefers actual pageviews without adding overlapping tab clicks", () => {
        const result = buildProductOverview(views, 0, { count: 0, base: 0 }, [],
            { available: true, tabs: [{ tab: "Mesas", opens: 50 }] });
        expect(result.qr_code_mesa).toMatchObject({ pageViews: 20, trafficSource: "pageviews" });
    });
    it("can use tab opens when pageviews are unavailable but never uses unavailable tab data", () => {
        const pageViews = { imenu: null, ia_plus: null, qr_code_mesa: null };
        const tabs = [{ tab: "Mesas", opens: 10 }];
        const available = buildProductOverview(pageViews, 0, { count: 0, base: 0 }, [], { available: true, tabs });
        const unavailable = buildProductOverview(pageViews, 0, { count: 0, base: 0 }, [], { available: false, tabs });
        expect(available.qr_code_mesa).toMatchObject({ pageViews: 10, trafficSource: "tab_opens" });
        expect(unavailable.qr_code_mesa).toMatchObject({ pageViews: null, conversion: null });
    });
});
