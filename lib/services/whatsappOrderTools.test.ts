import OpenAI from "openai";
import type { AutomaticPromotion } from "@/lib/promotions/automatic";
import { getWhatsAppAiReply } from "./whatsappAi";
import type { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/database/sql";
import { fetchAddressByCEP, fetchCoordinates } from "@/lib/api/geocodingBase";
import { createMercadoPagoPixCharge } from "@/lib/payments/mercadoPagoPix";
import { loadWhatsAppOrderTools } from "./whatsappOrderTools";
import type { WhatsAppOrderDraft } from "./whatsappOrderDraft";

jest.mock("openai", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/lib/addons/access", () => ({ hasIMenuPlusAccess: jest.fn().mockResolvedValue(true) }));
jest.mock("@/lib/services/wahaClient", () => ({
    getWahaRecentTextHistory: jest.fn().mockResolvedValue([]),
    startWahaTyping: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("next/server", () => ({ ...jest.requireActual("next/server"), after: jest.fn() }));
jest.mock("@/lib/push/server", () => ({ notifyOrderReady: jest.fn() }));
jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/lib/payments/mercadoPagoPix", () => ({ createMercadoPagoPixCharge: jest.fn() }));
jest.mock("@/lib/api/geocodingBase", () => ({
    ...jest.requireActual("@/lib/api/geocodingBase"),
    fetchAddressByCEP: jest.fn(),
    fetchCoordinates: jest.fn(),
}));

const context = {
    restaurantId: "30000000-0000-4000-8000-000000000001",
    chatId: "11999990000@c.us",
    phone: "11999990000",
    menuLink: "https://example.com/restaurante",
};
const productId = "10000000-0000-4000-8000-000000000001";
const optionId = "20000000-0000-4000-8000-000000000001";
const giftId = "10000000-0000-4000-8000-000000000002";
const orderId = "50000000-0000-4000-8000-000000000001";
const product = {
    id: productId, name: "Hambúrguer", price_cents: 1500, is_available: true,
    stock_enabled: true, stock_quantity: 12,
    subcategories: [{
        id: "tamanho", name: "Tamanho", min_select: 1, max_select: 1,
        subitems: [{ id: optionId, name: "Grande", price_cents: 200, is_available: true }],
    }],
};
const store = {
    id: context.restaurantId, url_slug: "restaurante", pickup_enabled: true, preorder_only: false,
    availability_json: { 1: [{ open: "09:00", close: "21:00" }] },
    is_closed: null, manual_open_until: null, allowed_payment_methods: ["pix", "dinheiro", "debito-entrega"],
    automatic_promotions: [] as AutomaticPromotion[], latitude: -22.56, longitude: -47.4,
    address: { street: "Rua da Loja" }, delivery_fee_json: [{ radius_km: 5, time_minutes: 20, fee_cents: 500 }],
};
let restaurant: typeof store;
let item: typeof product;
let draft: WhatsAppOrderDraft | null;
let orderInsert: unknown[] | null;
let writes: string[];
let paymentCode: string | null;
let enabled: boolean;
let draftColumnAvailable: boolean;
let mode: "bot" | "human";

beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-23T15:00:00Z"));
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    restaurant = { ...store };
    item = { ...product };
    draft = null;
    orderInsert = null;
    paymentCode = null;
    writes = [];
    enabled = true;
    draftColumnAvailable = true;
    mode = "bot";
    (createMercadoPagoPixCharge as jest.Mock).mockResolvedValue({ id: "pix-provider", qrCodeText: "pix-test" });
    (fetchAddressByCEP as jest.Mock).mockResolvedValue({ street: "Rua Um", neighborhood: "Centro", city: "Limeira", state: "SP" });
    (fetchCoordinates as jest.Mock).mockResolvedValue({ latitude: -22.56, longitude: -47.41 });
    (query as jest.Mock).mockImplementation(async (sql: string, args: any[]) => {
        if (sql.includes("chat_count")) return { rows: [{ chat_count: 0, restaurant_count: 0 }] };
        if (sql.includes("SELECT c.order_draft")) {
            return { rows: mode === "bot" ? [{ order_draft: draft, enabled }] : [], rowCount: 1 };
        }
        if (sql.includes("SELECT order_draft")) {
            if (!draftColumnAvailable) throw Object.assign(new Error("column order_draft does not exist"), { code: "42703" });
            return { rows: [{ order_draft: draft }], rowCount: 1 };
        }
        if (sql.includes("UPDATE whatsapp_conversations SET order_draft")) {
            if (args.length === 4 && ((draft?.revision ?? null) !== args[2] || mode !== "bot")) return { rows: [], rowCount: 0 };
            draft = JSON.parse(args.at(-1));
            if (draft?.address) {
                // PostgreSQL JSONB does not preserve address field insertion order.
                draft.address = Object.fromEntries(Object.entries(draft.address).reverse()) as typeof draft.address;
            }
        }
        if (sql.includes("FROM restaurants r WHERE r.id=") || sql.includes("SELECT preorder_only") || sql.includes("SELECT url_slug")) {
            return { rows: [restaurant], rowCount: 1 };
        }
        const gift = { ...item, id: giftId, name: "Suco", price_cents: 650, subcategories: [] };
        if (sql.includes("FROM items i JOIN categories")) {
            return { rows: [item, gift].filter(product => args[1].includes(product.id)) };
        }
        if (sql.includes("LEFT JOIN promotions")) return { rows: [item, gift] };
        if (sql.includes("FROM subitems s JOIN item_subcategories")) {
            return { rows: [{ ...item.subcategories[0].subitems[0], item_id: item.id }] };
        }
        if (/FROM items\s+WHERE id/.test(sql)) {
            const product = args[0] === giftId ? gift : item;
            return { rows: [{ ...product, restaurant_id: context.restaurantId }], rowCount: 1 };
        }
        if (sql.includes("INSERT INTO orders")) {
            orderInsert = args;
            return { rows: [{ id: orderId }], rowCount: 1 };
        }
        if (sql.includes("INSERT INTO order_items")) return { rows: [{ id: "order-item" }], rowCount: 1 };
        if (sql.includes("pix_copia_cola =")) paymentCode = args[2];
        if (sql.includes("SELECT display_id, status, payment_paid_at")) {
            return { rows: [{
                display_id: "31", status: orderInsert?.[1], pix_copia_cola: paymentCode, payment_paid_at: null,
            }], rowCount: 1 };
        }
        if (sql.includes("stock_quantity -")) writes.push("stock");
        return { rows: [], rowCount: 1 };
    });
    (withTransaction as jest.Mock).mockImplementation((callback: (client: Pick<PoolClient, "query">) => Promise<unknown>) =>
        callback({ query: query as unknown as PoolClient["query"] }));
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

const add = {
    line_id: null, item_ids: [productId], quantity: 2, options: [{ id: optionId, quantity: 1 }], observation: "Sem cebola",
};

async function prepare(payment = "pix", destination = "retirada") {
    const checkout = await loadWhatsAppOrderTools(context);
    await checkout.execute("order_set_item", add);
    await checkout.execute("order_set_details", {
        name: "Cliente", payment, schedule: "agora", destination,
        ...(destination === "entrega" ? { cep: "13480000", numero: "123" } : {}),
    });
    const result = await checkout.execute("order_review", {});
    if (!result || !("reply" in result)) throw new Error(JSON.stringify(result));
    const code = result.reply.match(/CONFIRMAR \d{6}/)?.[0];
    if (!code) throw new Error("Resumo sem código");
    return { checkout, code, summary: result.reply };
}

it("monta pedido, calcula taxa pelo endereço e gera o Pix oficial somente após confirmação", async () => {
    const { checkout, code, summary } = await prepare("pix", "entrega");
    expect(summary).toContain("2× Hambúrguer");
    expect(summary).toContain("1× Grande");
    expect(summary).toContain("Sem cebola");
    expect(summary).toContain("Rua Um, 123, Centro, Limeira - SP");
    expect(summary).toMatch(/Total: R\$\s*39,00/);
    expect(orderInsert).toBeNull();
    expect(await checkout.confirm("sim")).toBeNull();
    const duplicate = await loadWhatsAppOrderTools(context);
    expect(await checkout.confirm(code)).toContain("Pix copia e cola:\npix-test");
    expect(await duplicate.confirm(code)).toContain(orderId);
    expect(await (await loadWhatsAppOrderTools(context)).confirm(code)).toContain("Pedido #31");
    expect(orderInsert?.slice(1, 5)).toEqual(["pending_online_payment", 3400, 500, 3900]);
    expect(writes).toEqual(["stock"]);
    expect(createMercadoPagoPixCharge).toHaveBeenCalledTimes(1);
    expect(createMercadoPagoPixCharge).toHaveBeenCalledWith(expect.objectContaining({ amount: 39, idempotencyKey: orderId }));
    expect(draft).toMatchObject({ items: [], receipt: { orderId } });
    expect(draft?.address).toBeUndefined();
});

it("cria retirada com pagamento físico sem chamar o provedor Pix", async () => {
    const { checkout, code, summary } = await prepare("debito-entrega");
    expect(summary).toContain("Débito (Na retirada)");
    expect(await checkout.confirm(code)).toContain("Pedido #31 registrado");
    expect(orderInsert?.slice(1, 5)).toEqual(["pending_physical_payment", 3400, 0, 3400]);
    expect(createMercadoPagoPixCharge).not.toHaveBeenCalled();
});

it("reexibe o resumo quando muda o preço, sem criar o pedido anterior", async () => {
    const { checkout, code } = await prepare();
    item.price_cents += 500;
    const response = await checkout.confirm(code);
    expect(response).toContain("O pedido mudou");
    expect(response).toMatch(/Total: R\$\s*44,00/);
    expect(orderInsert).toBeNull();
    expect(await checkout.confirm(code)).toMatch(/não corresponde/);
});

it.each(["sem estoque", "atendimento humano", "Robô com IA desligado"])("protege a confirmação com %s", async condition => {
    const { checkout, code } = await prepare();
    if (condition === "sem estoque") item.stock_quantity = 1;
    if (condition === "atendimento humano") mode = "human";
    if (condition === "Robô com IA desligado") enabled = false;
    expect(await checkout.confirm(code)).toMatch(/Estoque insuficiente|Este resumo não está mais disponível/);
    expect(orderInsert).toBeNull();
    expect(createMercadoPagoPixCharge).not.toHaveBeenCalled();
});

it("exige complementos e recusa forma de pagamento desativada", async () => {
    const checkout = await loadWhatsAppOrderTools(context);
    expect(await checkout.execute("order_set_item", { ...add, options: [] })).toMatchObject({
        output: { error: expect.stringContaining("Tamanho") },
    });
    expect(await checkout.execute("order_set_details", { payment: "credito-entrega" })).toMatchObject({
        output: { error: expect.stringContaining("formas de pagamento") },
    });
    expect(draft).toBeNull();
});

it("usa o motor de promoções para inserir e exibir um brinde sem cobrar por ele", async () => {
    restaurant.automatic_promotions = [{
        id: "60000000-0000-4000-8000-000000000001", name: "Brinde",
        active: true, show_on_menu: true, delivery: true, mesa: false, allow_coupon: false, rules: [],
        benefits: [{ type: "product", item_id: giftId, quantity: 1 }],
    }];
    const { checkout, code, summary } = await prepare("dinheiro");
    expect(summary).toMatch(/1× Suco · R\$\s*0,00/);
    expect(summary).toMatch(/Total: R\$\s*34,00/);
    expect(await checkout.confirm(code)).toContain("registrado");
    expect(orderInsert?.[4]).toBe(3400);
    expect(writes).toEqual(["stock", "stock"]);
});

it("recusa entrega fora do raio e aceita agendamento dentro do horário", async () => {
    const checkout = await loadWhatsAppOrderTools(context);
    await checkout.execute("order_set_item", add);
    await checkout.execute("order_set_details", {
        name: "Cliente", payment: "dinheiro", destination: "entrega", cep: "13480000", numero: "123",
        schedule: "2026-11-23T11:45:00-03:00",
    });
    expect(await checkout.execute("order_review", {})).toMatchObject({ output: { error: expect.stringContaining("futuro") } });
    await checkout.execute("order_set_details", { schedule: "2026-11-23T12:45:00-03:00" });
    (fetchCoordinates as jest.Mock).mockResolvedValueOnce({ latitude: -22.56, longitude: -48 });
    expect(await checkout.execute("order_review", {})).toMatchObject({ output: { error: expect.stringContaining("fora da área") } });
    const review = await checkout.execute("order_review", {});
    expect(review).toMatchObject({ reply: expect.stringContaining("12:45") });
    expect(orderInsert).toBeNull();
});

it("confirma pelo WhatsApp sem delegar o código ao modelo", async () => {
    const { code } = await prepare("pix");
    const incoming = {
        ...context, sessionName: "fixture", messageId: "fixture", body: code,
        variables: { LINK_DO_CARDAPIO: context.menuLink },
        restaurantHours: { availability_json: store.availability_json, is_closed: null, manual_open_until: null, preorder_only: false },
    };
    expect(await getWhatsAppAiReply(incoming)).toEqual({ text: expect.stringContaining("pix-test") });
    expect(OpenAI).not.toHaveBeenCalled();
});


it("mantém as respostas sobre o cardápio enquanto a migração do carrinho está pendente", async () => {
    draftColumnAvailable = false;
    jest.replaceProperty(process, "env", { ...process.env, OPENAI_API_KEY: "test-key" });
    const create = jest.fn().mockResolvedValue({ output_text: "Temos hambúrguer.", output: [] });
    (OpenAI as unknown as jest.Mock).mockImplementation(() => ({ responses: { create } }));
    const incoming = {
        ...context, sessionName: "fixture", messageId: "fixture", body: "Tem hambúrguer?",
        variables: { LINK_DO_CARDAPIO: context.menuLink },
        restaurantHours: { availability_json: store.availability_json, is_closed: null, manual_open_until: null, preorder_only: false },
    };
    expect(await getWhatsAppAiReply({ ...incoming, orderingOnly: true })).toBeNull();
    expect(await getWhatsAppAiReply(incoming)).toEqual({ text: "Temos hambúrguer." });
    expect(create.mock.calls[0][0].tools).not.toContainEqual(expect.objectContaining({ name: "order_review" }));
    expect(orderInsert).toBeNull();
});
