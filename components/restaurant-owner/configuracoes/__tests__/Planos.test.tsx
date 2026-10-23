import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import PlanosPage from "@/app/painel/planos/page";
import PanelAppearance from "@/components/ui/PanelAppearance";
import QrCodeMesaSettingsSection from "../QrCodeMesaSettingsSection";

jest.mock("next/navigation", () => ({
    usePathname: () => "/painel/planos",
    useParams: () => ({}),
}));
jest.mock("@/app/painel/planos/planos.css", () => ({}));
jest.mock("@/lib/stores/restaurant-owner/creationStore", () => ({
    useCreationStore: () => ({ restaurantId: "fixture", setRestaurantId: jest.fn() }),
}));
jest.mock("@/lib/database/supabaseClient", () => ({ supabase: {} }));
jest.mock("@/lib/qr-table/analytics", () => ({ captureQrTableEvent: jest.fn() }));
jest.mock("@/lib/qr-table/clientApi", () => ({ qrTableAuthenticatedFetch: jest.fn() }));
jest.mock("@/components/restaurant-owner/mesas/QrCodeMesaSalesModal", () => () => null);
jest.mock("@/components/restaurant-owner/mesas/QrCodeMesaCheckoutModal", () => () => null);
jest.mock("@/components/restaurant-owner/ia-vendas/IaPlusSalesModal", () => () => null);
jest.mock("@/components/ui/ConfirmModal", () => () => null);

const makeAddon = (productKey: string, overrides = {}) => ({
    id: productKey,
    restaurant_id: "fixture",
    product_key: productKey,
    status: "active",
    price_cents: productKey === "ia_plus" ? 4999 : 500,
    billing_cycle: "monthly",
    payment_provider: "asaas",
    payzu_payment_method: null,
    payzu_recurrence_id: null,
    payzu_payment_status: null,
    current_period_ends_at: "2026-11-07T12:00:00.000Z",
    ...overrides,
});
const payment = {
    id: "payment",
    amount_cents: 500,
    status: "CONFIRMED",
    billing_type: "PIX",
    due_date: "2026-10-07",
    paid_at: "2026-10-07T12:00:00.000Z",
    invoice_url: "https://example.com/invoice",
    created_at: "2026-10-07T12:00:00.000Z",
};
const fixtures = {
    empty: { addons: [] },
    active: { addons: [
        { addon: makeAddon("ia_plus"), active: true, payments: [payment] },
        { addon: makeAddon("qr_code_mesa", { payment_provider: "mercadopago" }), active: true, payments: [payment] },
    ] },
    mixed: { addons: [
        { addon: makeAddon("qr_code_mesa", { payment_provider: "payzu", payzu_payment_method: "PIX", status: "canceled" }), active: true, payments: [payment] },
    ] },
};
afterEach(() => jest.restoreAllMocks());

function renderBilling(payload: typeof fixtures.empty | typeof fixtures.active | typeof fixtures.mixed, wholePage = false) {
    const state = jest.spyOn(React, "useState");
    // SSR does not run the authenticated load effect; seed only its existing state.
    if (wholePage) state.mockImplementationOnce(() => [false, jest.fn()] as never);
    state.mockImplementationOnce(() => [payload, jest.fn()] as never);
    state.mockImplementationOnce(() => [false, jest.fn()] as never);
    return renderToStaticMarkup(<PanelAppearance>{wholePage ? <PlanosPage /> :
        <QrCodeMesaSettingsSection restaurantId="fixture" showHeader={false} presentation="plans" />}</PanelAppearance>);
}

test("plans separate discovery from billing without selection checkboxes", () => {
    const html = renderBilling(fixtures.empty);
    expect(html).toContain("plans-included");
    expect(html).toContain("plans-products");
    expect(html).toContain('id="suas-assinaturas"');
    expect(html).toContain("Nenhum plano adicional contratado.");
    expect(html).not.toContain("aria-pressed");
    expect(html).not.toContain("Selecionar iMenu");
    expect(html.match(/Conhecer o plano/g)).toHaveLength(2);
});

test("active plans keep recurring cancellation and prepaid renewal with collapsed history", () => {
    const html = renderBilling(fixtures.active);
    expect(html.match(/data-active="true"/g)).toHaveLength(2);
    expect(html.match(/Conhecer meu plano/g)).toHaveLength(2);
    expect(html.match(/Descadastrar do plano/g)).toHaveLength(1);
    expect(html.match(/>Renovar</g)).toHaveLength(1);
    expect(html.match(/<details class="plans-payment-history">/g)).toHaveLength(2);
    expect(html.match(/class="plans-subscription-card"/g)).toHaveLength(2);
    expect(html).toContain("plans-subscription-identity");
    expect(html).toContain("https://example.com/invoice");
    expect(html).toContain("Confirmado");
    expect(html).toContain("07/11/2026");
});

test("historical canceled PayZu access keeps renewal without recurring cancellation", () => {
    const html = renderBilling(fixtures.mixed);
    expect(html).toContain('data-active="true"');
    expect(html).toContain(">Renovar<");
    expect(html).toContain("Cancelado");
    expect(html).not.toContain("Descadastrar do plano");
});

test.each(Object.entries(fixtures))("render the actual plans page for visual QA: %s", (name, payload) => {
    const html = renderBilling(payload, true);
    expect(html).toContain("Planos iMenu");
    expect(html).not.toContain("FEITO PARA O SEU RESTAURANTE");
    expect(html).not.toContain("Suas assinaturas ↓");
    expect(html).not.toContain("Disponível no seu painel");
    expect(html).toMatch(/<h3>iMenu Cardápio Digital<\/h3><span data-ui="badge"[^>]*>Grátis para sempre, sem limites<\/span>/);
    expect(html).toContain("Atendimento Exclusivo");
    expect(html).toContain("Cardápio digital na mesa através de QR Code");
    if (process.env.PLANS_VISUAL_DIR) {
        mkdirSync(process.env.PLANS_VISUAL_DIR, { recursive: true });
        writeFileSync(join(process.env.PLANS_VISUAL_DIR, name + ".html"), html);
    }
});
