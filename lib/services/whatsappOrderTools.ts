import { randomInt, randomUUID } from "node:crypto";
import type { Tool } from "openai/resources/responses/responses";
import { POST as createOrder } from "@/app/api/orders/route";
import { fetchAddressByCEP } from "@/lib/api/geocodingBase";
import { query, withTransaction } from "@/lib/database/sql";
import { getCheckoutFulfillment } from "@/lib/delivery/restaurantLocation";
import { parsePizzaSettings, isPizzaItem, PizzaPricingError } from "@/lib/pizza/pricing";
import { PromotionPricingError } from "@/lib/promotions/orderPricing";
import { isUuid } from "@/lib/promotions/automatic";
import {
    bindWhatsAppOrder, readWhatsAppOrderDraft, saveWhatsAppOrderDraft, WhatsAppOrderError,
    type DraftAddress, type DraftLine, type WhatsAppOrderChat, type WhatsAppOrderDraft,
} from "./whatsappOrderDraft";
import {
    loadWhatsAppCheckoutRestaurant, loadWhatsAppOrderItems, priceWhatsAppLine, quoteWhatsAppOrder,
    resolveWhatsAppAddress, whatsappPaymentOptions,
} from "./whatsappOrderPricing";

const MAX_LINES = 12;
const lineSchema = { type: ["string", "null"], description: "ID da linha existente, ou null para adicionar uma linha." };
const nullable = { type: ["string", "null"] };
const number = { type: "integer", minimum: 1, maximum: 99 };

function tool(name: string, description: string, properties: Record<string, unknown> = {}): Tool {
    return {
        type: "function", name, description, strict: true,
        parameters: { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
    };
}

const ADDRESS_KEYS = ["cep", "rua", "numero", "bairro", "cidade", "estado", "complemento", "referencia"] as const;
export const WHATSAPP_ORDER_TOOLS = [
    tool("order_options", "Carrega complementos obrigatórios, preços, opções e quantidade de sabores de um produto.", { item_id: { type: "string" } }),
    tool("order_set_item", "Adiciona ou substitui uma linha da sacola. Use IDs retornados pelas ferramentas e todas as escolhas do cliente.", {
        line_id: lineSchema, item_ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
        quantity: number,
        options: {
            type: "array", maxItems: 30, items: {
                type: "object", properties: { id: { type: "string" }, quantity: number },
                required: ["id", "quantity"], additionalProperties: false,
            },
        },
        observation: { type: "string" },
    }),
    tool("order_remove_item", "Remove uma linha da sacola solicitada pelo cliente.", { line_id: { type: "string" } }),
    tool("order_discard_cart", "Descarta toda a sacola quando o cliente pedir explicitamente."),
    tool("order_checkout_options", "Mostra formas de pagamento e opções de entrega ou retirada habilitadas."),
    tool("order_set_details", "Registra somente os dados expressamente informados ou escolhidos. Use null nos campos que não foram alterados.", {
        name: nullable,
        destination: { type: ["string", "null"], enum: ["entrega", "retirada", null] },
        schedule: { ...nullable, description: "'agora' ou data e hora ISO com fuso -03:00." },
        payment: nullable,
        ...Object.fromEntries(ADDRESS_KEYS.map(key => [key, nullable])),
    }),
    tool("order_review", "Mostra o resumo oficial e como confirmar. Use quando os dados estiverem completos ou quando o cliente pedir para rever."),
    tool("order_receipt", "Reenvia o comprovante do pedido deste chat, com Pix copia e cola se ainda estiver pendente."),
];

export type WhatsAppOrderContext = WhatsAppOrderChat & { phone: string; menuLink: string };
type ToolResult = { output: unknown } | { reply: string };

const ORDER_INSTRUCTIONS = [
    "Você pode montar a sacola e guiar o cliente até a confirmação neste chat. Para ver o cardápio visual, use menu_link.",
    "Se o cliente quer pedir e ainda não citou produtos, pergunte o que deseja. Para pedir, encontre IDs com search_menu e descubra complementos com order_options. Pergunte por produto, quantidade, sabores e complementos obrigatórios se houver dúvida. Nunca escolha substituições ou adicionais por conta própria.",
    "Registre nome, entrega ou retirada, endereço se for entrega, agora ou agendado e a forma de pagamento escolhida. Consulte order_checkout_options para listar só modalidades disponíveis. Use o CEP informado pelo cliente para preencher o endereço.",
    "As ferramentas validam preços, estoque, complementos, mínimo, endereço, taxa, horário e pagamento. Quando a sacola estiver completa, chame order_review. Somente o código de confirmação do resumo, enviado pelo próprio cliente, autoriza o envio. Nunca afirme que criou um pedido sem resultado do sistema.",
    "Mesmo que a pessoa diga sim, aceitar ou confirmar, não presuma que o pedido foi enviado. Mostre um resumo oficial se ainda não foi enviado. Se já foi enviado, peça que a pessoa responda exatamente com o comando do resumo.",
    "Em caso de dúvida sobre Pix, chame order_receipt para o último pedido deste chat ou order_status para o acompanhamento. Nunca confirme pagamento com base em foto ou texto do cliente.",
].join("\n");

export async function loadWhatsAppOrderTools(context: WhatsAppOrderContext) {
    let state = await readWhatsAppOrderDraft(context);
    const activeDraft = () => state.draft?.receipt ? null : state.draft;
    async function update(draft: Omit<WhatsAppOrderDraft, "revision" | "expiresAt"> | null) {
        const saved = await saveWhatsAppOrderDraft(context, state.revision, draft);
        state = { revision: saved?.revision ?? null, draft: saved };
    }

    const draftForModel = () => {
        const draft = activeDraft();
        if (!draft) return null;
        const { revision, expiresAt, quote, ...data } = draft;
        return { ...data, aguardando_confirmacao: Boolean(quote) };
    };

    const catalog = (ids: string[]) => withTransaction(client => loadWhatsAppOrderItems(client, context.restaurantId, ids));
    const restaurant = () => withTransaction(client => loadWhatsAppCheckoutRestaurant(client, context.restaurantId));

    async function currentQuote(draft: WhatsAppOrderDraft) {
        const store = await restaurant();
        const point = draft.destination === "entrega" && draft.address
            ? await resolveWhatsAppAddress(store, draft.address)
            : null;
        const quote = await withTransaction(client => quoteWhatsAppOrder(client, store, draft, point));
        return { quote, point };
    }

    async function review(draft: WhatsAppOrderDraft, current?: Awaited<ReturnType<typeof currentQuote>>) {
        const { quote } = current ?? await currentQuote(draft);
        const code = String(randomInt(100000, 1000000));
        await update({ ...draft, quote: { code, hash: quote.hash } });
        return `${quote.summary}\n\nPara enviar o pedido, responda *CONFIRMAR ${code}*.`;
    }

    async function receipt(orderId: string) {
        const { rows } = await query<{
            display_id: string | null; status: string; payment_paid_at: string | null; pix_copia_cola: string | null;
        }>(
            `SELECT display_id, status, payment_paid_at, pix_copia_cola
             FROM orders WHERE id=$1 AND restaurant_id=$2 AND public.crm_phone(customer_phone)=$3`,
            [orderId, context.restaurantId, context.phone],
        );
        const order = rows[0];
        if (!order) return "Não encontrei o pedido deste chat.";
        const link = `${context.menuLink.replace(/\/$/, "")}/${orderId}`;
        const title = order.display_id ? `Pedido #${order.display_id}` : "Pedido";
        if (order.status === "canceled") return `${title} cancelado. Você pode montar um novo pedido.\n${link}`;
        if (order.status === "pending_online_payment") {
            const instructions = order.pix_copia_cola
                ? `Pix copia e cola:\n${order.pix_copia_cola}`
                : "O Pix ainda não está disponível. Confira o link para acompanhar.";
            return `${title} aguardando pagamento.\n\n${instructions}\n\n${link}`;
        }
        return `${title} registrado.${order.payment_paid_at ? " Pagamento confirmado." : ""}\nAcompanhe: ${link}`;
    }

    async function confirm(text: string): Promise<string | null> {
        const code = confirmationCode(text);
        if (!code) return null;
        const draft = state.draft;
        if (draft?.receipt?.code === code) return receipt(draft.receipt.orderId);
        if (!draft?.quote || draft.quote.code !== code) {
            return "Esse código não corresponde ao resumo atual. Peça um novo resumo antes de confirmar.";
        }
        try {
            const current = await currentQuote(draft);
            if (current.quote.hash !== draft.quote.hash) {
                return "O pedido mudou desde o último resumo. Confira os valores atualizados.\n\n" + await review(draft, current);
            }
            const confirmation = { ...context, draft: { ...draft, quote: draft.quote }, point: current.point };
            const request = new Request(new URL("/api/orders", context.menuLink), {
                method: "POST", body: JSON.stringify({ ...current.quote.body, customer_phone: context.phone }),
            });
            const result = await createOrder(bindWhatsAppOrder(request, confirmation));
            const data = await result.json();
            const latest = (await readWhatsAppOrderDraft(context)).draft;
            if (latest?.receipt?.code === code) return receipt(latest.receipt.orderId);
            if (result.ok && (data.order_id || data.id)) return receipt(data.order_id || data.id);
            if (result.status >= 500) return "Não consegui verificar o envio. Peça para acompanhar o pedido antes de tentar novamente.";
            return data.error || "Não foi possível enviar o pedido. Peça um novo resumo.";
        } catch (error) {
            if (error instanceof WhatsAppOrderError || error instanceof PizzaPricingError || error instanceof PromotionPricingError) {
                return error.message;
            }
            console.warn("[WHATSAPP_ORDER] confirmation_failed", { restaurantId: context.restaurantId });
            return "Não consegui verificar o envio. Peça para acompanhar o pedido antes de tentar novamente.";
        }
    }

    async function execute(name: string, args: Record<string, unknown>): Promise<ToolResult | null> {
        const draft = activeDraft();
        try {
            switch (name) {
                case "order_options": {
                    if (!isUuid(args.item_id)) throw new WhatsAppOrderError("Selecione um produto encontrado no cardápio.");
                    const [store, products] = await Promise.all([restaurant(), catalog([args.item_id])]);
                    const item = products.get(args.item_id);
                    if (!item?.is_available) throw new WhatsAppOrderError("Produto indisponível.");
                    const settings = parsePizzaSettings(store.pizza_settings);
                    return { output: {
                        item: item.name, price_cents: item.price_cents,
                        max_flavors: isPizzaItem(item, settings) ? settings.max_flavors : 1,
                        groups: item.subcategories.map(group => ({
                            name: group.name, min: group.min_select,
                            max: group.max_select === 0 && !group.allow_multiple_units ? 1 : group.max_select,
                            max_per_option: group.allow_multiple_units ? group.max_per_option : 1,
                            options: group.subitems.map(option => ({ id: option.id, name: option.name, price_cents: option.price_cents })),
                        })),
                    } };
                }
                case "order_set_item": {
                    const { item_ids, quantity, options, line_id, observation } = args;
                    const items = draft?.items ?? [];
                    if (!Array.isArray(item_ids) || !item_ids.length || item_ids.length > 8 ||
                        !item_ids.every(isUuid) || new Set(item_ids).size !== item_ids.length ||
                        !validQuantity(quantity) || !Array.isArray(options) || options.length > 30 ||
                        !options.every(option => option && isUuid(option.id) && validQuantity(option.quantity)) ||
                        (line_id !== null && !items.some(item => item.id === line_id))) {
                        throw new WhatsAppOrderError("Confira o produto, a quantidade e os complementos selecionados.");
                    }
                    if (!line_id && items.length >= MAX_LINES) throw new WhatsAppOrderError("A sacola atingiu o limite de produtos para pedidos pelo WhatsApp.");
                    const line: DraftLine = {
                        id: typeof line_id === "string" ? line_id : randomUUID(),
                        itemIds: item_ids, quantity, options: options.map(({ id, quantity }) => ({ id, quantity })),
                        observation: cleanText(observation, 160),
                    };
                    const [store, products] = await Promise.all([restaurant(), catalog(item_ids)]);
                    const priced = priceWhatsAppLine(line, products, store.pizza_settings, draft?.schedule ? new Date(draft.schedule) : new Date());
                    await update({ ...draft, items: line_id ? items.map(item => item.id === line_id ? line : item) : [...items, line], quote: undefined });
                    return { output: { draft: draftForModel(), line: priced } };
                }
                case "order_remove_item": {
                    if (!draft?.items.some(item => item.id === args.line_id)) throw new WhatsAppOrderError("Esse produto não está na sacola.");
                    await update({ ...draft, items: draft.items.filter(item => item.id !== args.line_id), quote: undefined });
                    return { output: { draft: draftForModel() } };
                }
                case "order_discard_cart":
                    if (draft) await update(null);
                    return { output: { sacola_descartada: true } };
                case "order_checkout_options": {
                    const store = await restaurant();
                    const location = getCheckoutFulfillment(store, false, true);
                    return { output: {
                        entrega: !location.deliveryDisabled && !location.missingDeliveryOrigin,
                        retirada: location.isPickup,
                        pagamentos: whatsappPaymentOptions(store, draft?.destination),
                        agendamento_futuro: store.allow_future_order_scheduling || store.preorder_only,
                        cep_obrigatorio: !(store.delivery_fee_mode === "neighborhood" && store.small_city_mode_enabled),
                    } };
                }
                case "order_set_details": {
                    const next = { ...draft, items: draft?.items ?? [], quote: undefined };
                    const name = cleanText(args.name);
                    if (name) next.name = name;
                    if (args.destination === "entrega" || args.destination === "retirada") next.destination = args.destination;
                    if (args.schedule === "agora") next.schedule = null;
                    if (typeof args.schedule === "string" && args.schedule !== "agora") {
                        const date = new Date(args.schedule);
                        if (!Number.isFinite(date.getTime())) throw new WhatsAppOrderError("Informe data e horário válidos.");
                        next.schedule = date.toISOString();
                    }
                    if (typeof args.payment === "string") {
                        if (!whatsappPaymentOptions(await restaurant(), next.destination).some(option => option.method === args.payment)) {
                            throw new WhatsAppOrderError("Escolha uma das formas de pagamento disponíveis.");
                        }
                        next.payment = args.payment;
                    }
                    if (ADDRESS_KEYS.some(key => typeof args[key] === "string")) {
                        const cep = cleanText(args.cep).replace(/\D/g, "");
                        const address = { ...next.address } as DraftAddress;
                        if (cep && cep !== address.cep) {
                            if (cep.length !== 8) throw new WhatsAppOrderError("Informe o CEP com 8 dígitos.");
                            const postal = await fetchAddressByCEP(cep);
                            if (!postal) throw new WhatsAppOrderError("Não encontrei esse CEP. Confira os dígitos.");
                            Object.assign(address, {
                                cep, rua: postal.street, bairro: postal.neighborhood, cidade: postal.city, estado: postal.state,
                                numero: "", complemento: "", referencia: "",
                            });
                        }
                        for (const key of ADDRESS_KEYS) {
                            if (key !== "cep" && typeof args[key] === "string") address[key] = cleanText(args[key]);
                        }
                        address.estado = (address.estado ?? "").toUpperCase();
                        next.address = address;
                    }
                    await update(next);
                    return { output: { draft: draftForModel() } };
                }
                case "order_review":
                    if (!draft) throw new WhatsAppOrderError("Adicione um produto à sacola.");
                    return { reply: await review(draft) };
                case "order_receipt":
                    if (!state.draft?.receipt) throw new WhatsAppOrderError("Não há um pedido recente finalizado por este chat.");
                    return { reply: await receipt(state.draft.receipt.orderId) };
                default: return null;
            }
        } catch (error) {
            if (error instanceof WhatsAppOrderError || error instanceof PizzaPricingError) return { output: { error: error.message } };
            if (error instanceof PromotionPricingError) return { reply: `${error.message}\nConfira a oferta e conclua pelo cardápio: ${context.menuLink}` };
            throw error;
        }
    }

    return { instructions: ORDER_INSTRUCTIONS, draftForModel, execute, confirm };
}

function cleanText(value: unknown, length = 120) {
    return typeof value === "string" ? value.trim().replace(/[\r\n]/g, " ").slice(0, length) : "";
}

function validQuantity(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 99;
}

export function confirmationCode(text: string) {
    return /^confirmar\s+(\d{6})$/i.exec(text.trim())?.[1] ?? null;
}
