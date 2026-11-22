import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { fetchAddressByCEP, fetchCoordinates, type Coordinates } from "@/lib/api/geocodingBase";
import { lookupCnefe } from "@/lib/delivery/cnefe";
import { findNeighborhoodDeliveryRule } from "@/lib/delivery/neighborhood";
import { findCheckoutDeliveryTier, getCheckoutDeliveryDistanceKm, getCheckoutFulfillment } from "@/lib/delivery/restaurantLocation";
import { isCategoryAvailable } from "@/lib/menu/categorySchedule";
import { isItemAvailableForChannel } from "@/lib/menu/itemAvailability";
import { getOrderScheduleDate, getOrderScheduleOptions, getSameDayOrderEarliestAt } from "@/lib/menu/orderAvailability";
import { isStoreManuallyClosed } from "@/lib/menu/storeHoursOverride";
import { CHECKOUT_PAYMENT_METHODS, cardAtDeliveryLabel, isCardAtDeliveryMethod, normalizeAllowedPaymentMethods } from "@/lib/payments/deliveryMethods";
import { assertPizzaCategoriesCanCombine, isPizzaItem, matchPizzaComplements, parsePizzaSettings, pizzaStockItemIds, pricePizza } from "@/lib/pizza/pricing";
import { automaticOrderPricing } from "@/lib/promotions/orderPricing";
import type { CartItem, PizzaCatalogItem, Restaurant } from "@/lib/types/types";
import { formatPrice, promotionPrice } from "@/lib/utils/formatPrice";
import { buildWhatsAppOpeningContext } from "./whatsappMessageTemplates";
import { WhatsAppOrderError, type DraftAddress, type DraftLine, type WhatsAppOrderDraft } from "./whatsappOrderDraft";

type OrderDb = Pick<PoolClient, "query">;
type CheckoutRestaurant = Restaurant & Parameters<typeof buildWhatsAppOpeningContext>[0];
type CatalogItem = PizzaCatalogItem & { stock_enabled: boolean; stock_quantity: number | null };

export async function loadWhatsAppCheckoutRestaurant(client: OrderDb, restaurantId: string) {
    const result = await client.query<CheckoutRestaurant>(
        `SELECT r.id, r.address, r.latitude, r.longitude, r.pickup_enabled, r.delivery_disabled,
                r.delivery_fee_mode, r.delivery_fee_json, r.delivery_neighborhood_fee_json, r.small_city_mode_enabled,
                r.availability_json, r.preorder_only, r.preorder_availability_json,
                r.preorder_min_days, r.allow_future_order_scheduling, r.min_order_cents, r.prep_time_max_minutes,
                r.allowed_payment_methods, r.pizza_settings, r.automatic_promotions,
                to_char(r.manual_open_until AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS manual_open_until,
                to_char(r.is_closed, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS is_closed
         FROM restaurants r WHERE r.id=$1 AND r.url_slug IS NOT NULL`,
        [restaurantId],
    );
    if (!result.rows[0]) throw new WhatsAppOrderError("O cardápio está indisponível.");
    return result.rows[0];
}

export async function loadWhatsAppOrderItems(client: OrderDb, restaurantId: string, ids: string[]) {
    const { rows } = await client.query<CatalogItem>(
        `SELECT i.id, i.name, i.price_cents, i.category_id, i.is_available, i.available_for_delivery,
                i.availability_schedule, i.stock_enabled, i.stock_quantity,
                jsonb_build_object('id',c.id,'availability_schedule',c.availability_schedule) AS category,
                (SELECT jsonb_build_object('type',p.type,'value',p.value)
                 FROM promotions p WHERE p.item_id=i.id AND p.restaurant_id=i.restaurant_id
                   AND p.active AND p.starts_at<=NOW() AND (p.ends_at>=NOW() OR p.ends_at IS NULL)
                 ORDER BY p.starts_at DESC, p.id LIMIT 1) AS promotion,
                COALESCE((SELECT jsonb_agg(g ORDER BY g.position,g.id) FROM (
                    SELECT sc.*, COALESCE((SELECT jsonb_agg(s ORDER BY s.position,s.id)
                      FROM subitems s WHERE s.item_subcategory_id=sc.id AND s.is_available),'[]'::jsonb) AS subitems
                    FROM item_subcategories sc WHERE sc.item_id=i.id
                ) g), '[]'::jsonb) AS subcategories
         FROM items i JOIN categories c ON c.id=i.category_id AND c.restaurant_id=i.restaurant_id
         WHERE i.restaurant_id=$1 AND i.id=ANY($2::uuid[])`,
        [restaurantId, ids],
    );
    return new Map(rows.map(item => [item.id, item]));
}

export function paymentLabel(method: string, destination?: WhatsAppOrderDraft["destination"]) {
    if (isCardAtDeliveryMethod(method)) return cardAtDeliveryLabel(method, destination);
    if (method === "pix") return "Pix (Online)";
    if (method === "pix-entrega") return destination === "retirada" ? "Pix (Na retirada)" : "Pix (Na entrega)";
    return "Dinheiro";
}

export function whatsappPaymentOptions(restaurant: CheckoutRestaurant, destination?: WhatsAppOrderDraft["destination"]) {
    const enabled = normalizeAllowedPaymentMethods(restaurant.allowed_payment_methods);
    return CHECKOUT_PAYMENT_METHODS.filter(method => enabled.includes(method)).map(method => ({
        method, label: paymentLabel(method, destination),
    }));
}

function fullAddress(address: DraftAddress) {
    return [address.rua, address.numero, address.bairro, `${address.cidade} - ${address.estado}`, address.cep, "Brasil"].join(", ");
}

export async function resolveWhatsAppAddress(restaurant: CheckoutRestaurant, address: DraftAddress) {
    if (!address.rua || !address.numero || !address.bairro || !address.cidade || !/^[A-Z]{2}$/.test(address.estado)) {
        throw new WhatsAppOrderError("Informe rua, número, bairro, cidade e estado da entrega.");
    }
    if (restaurant.delivery_fee_mode === "neighborhood" && restaurant.small_city_mode_enabled) return null;
    if (!/^\d{8}$/.test(address.cep)) throw new WhatsAppOrderError("Informe o CEP de entrega com 8 dígitos.");

    const postal = await fetchAddressByCEP(address.cep);
    if (!postal) throw new WhatsAppOrderError("Não consegui validar o CEP. Confira o endereço.");
    const origin = { latitude: Number(restaurant.latitude), longitude: Number(restaurant.longitude) };
    const distance = (point: Coordinates) => getCheckoutDeliveryDistanceKm(
        false, origin.latitude, origin.longitude, point.latitude, point.longitude,
    );
    const tier = (km: number) => findCheckoutDeliveryTier(km, restaurant.delivery_fee_json);
    const radius = restaurant.delivery_fee_mode !== "neighborhood";
    const point = await fetchCoordinates(
        fullAddress(address),
        radius ? point => tier(distance(point)) !== null : undefined,
        radius ? {
            origin,
            acceptsRange: ({ min, max }) => {
                const nearest = tier(min);
                const farthest = tier(max);
                return nearest !== null && farthest !== null && nearest.radius_km === farthest.radius_km;
            },
        } : undefined,
        !postal.street?.trim() && !postal.neighborhood?.trim(),
        lookupCnefe,
    );
    if (!point) throw new WhatsAppOrderError("Não consegui localizar esse endereço com segurança. Confira os dados ou escolha retirada.");
    return point;
}

function deliveryTerms(restaurant: CheckoutRestaurant, draft: WhatsAppOrderDraft, point: Coordinates | null) {
    const pickup = draft.destination === "retirada";
    const location = getCheckoutFulfillment(restaurant, false, pickup);
    if (pickup) {
        if (!location.isPickup) throw new WhatsAppOrderError("O restaurante não oferece retirada.");
        return { fee: 0, time: restaurant.prep_time_max_minutes || 40 };
    }
    if (!draft.destination) throw new WhatsAppOrderError("Você prefere entrega ou retirada?");
    if (location.deliveryDisabled || location.missingDeliveryOrigin) throw new WhatsAppOrderError("A entrega não está disponível neste cardápio.");
    if (!draft.address) throw new WhatsAppOrderError("Informe o endereço de entrega.");
    const { bairro, cidade, estado } = draft.address;
    const rule = restaurant.delivery_fee_mode === "neighborhood"
        ? findNeighborhoodDeliveryRule(restaurant.delivery_neighborhood_fee_json, bairro, cidade, estado)
        : point && findCheckoutDeliveryTier(
            getCheckoutDeliveryDistanceKm(false, Number(restaurant.latitude), Number(restaurant.longitude), point.latitude, point.longitude),
            restaurant.delivery_fee_json,
        );
    const fee = Number(rule?.fee_cents);
    const time = Number(rule?.time_minutes);
    if (!rule || !Number.isSafeInteger(fee) || fee < 0 || !Number.isFinite(time) || time < 0) {
        throw new WhatsAppOrderError("Esse endereço está fora da área de entrega.");
    }
    return { fee, time: time || 40 };
}

function orderSchedule(restaurant: CheckoutRestaurant, value: string | null | undefined, now: Date) {
    const opening = buildWhatsAppOpeningContext(restaurant, now);
    if (!value) {
        if (value === undefined) throw new WhatsAppOrderError("Informe se prefere o pedido para agora ou agendado.");
        if (opening.somente_encomendas || !opening.aberto_agora) {
            throw new WhatsAppOrderError("O restaurante está fechado para pedidos imediatos. Escolha uma data e um horário para agendar.");
        }
        return null;
    }
    const scheduled = new Date(value);
    if (!Number.isFinite(scheduled.getTime()) || scheduled <= now) throw new WhatsAppOrderError("Escolha um horário futuro.");
    const today = getOrderScheduleDate(now);
    const date = getOrderScheduleDate(scheduled);
    const days = (Date.parse(date) - Date.parse(today)) / 86_400_000;
    const advance = restaurant.preorder_only ? Math.max(0, Number(restaurant.preorder_min_days) || 0) : 0;
    if (days < advance || days >= 60 || (days > 0 && !restaurant.preorder_only && !restaurant.allow_future_order_scheduling)) {
        throw new WhatsAppOrderError("A data escolhida está fora do período de agendamento do restaurante.");
    }
    const options = getOrderScheduleOptions(
        restaurant.preorder_only ? restaurant.preorder_availability_json : restaurant.availability_json,
        date, now, date === today && isStoreManuallyClosed(restaurant.is_closed, now) && !opening.aberto_agora,
        getSameDayOrderEarliestAt(restaurant, now),
    );
    if (!options.some(option => option.value === scheduled.toISOString())) {
        const nearby = options.slice(0, 5).map(option => option.label).join(", ");
        throw new WhatsAppOrderError(nearby ? `Escolha um horário disponível nessa data: ${nearby}.` : "Não há horários disponíveis nessa data.");
    }
    return scheduled;
}

export function priceWhatsAppLine(
    line: DraftLine, products: Map<string, CatalogItem>, settingsValue: unknown, at: Date,
): CartItem {
    const productsInLine = line.itemIds.map(id => {
        const item = products.get(id);
        if (!item?.is_available || !isItemAvailableForChannel(item, "entrega") ||
            !isCategoryAvailable(item.category?.availability_schedule, at) ||
            !isCategoryAvailable(item.availability_schedule, at)) {
            throw new WhatsAppOrderError(`${item?.name || "Um produto"} não está disponível para este horário.`);
        }
        return item;
    });
    const item = productsInLine[0];
    const groups = item.subcategories.map(group => ({
        ...group, max_select: group.max_select === 0 && !group.allow_multiple_units ? 1 : group.max_select,
    }));
    const requestedOptions = line.options.map(option => {
        const group = groups.find(group => group.subitems.some(subitem => subitem.id === option.id));
        const subitem = group?.subitems.find(subitem => subitem.id === option.id);
        if (!group || !subitem) throw new WhatsAppOrderError(`Um complemento de ${item.name} não está mais disponível.`);
        return {
            subcategoryId: group.id, subcategoryName: group.name, subitemId: subitem.id,
            subitemName: subitem.name, price_cents: subitem.price_cents, quantity: option.quantity,
        };
    });
    const selectedSubitems = matchPizzaComplements(requestedOptions, groups, true);
    const settings = parsePizzaSettings(settingsValue);
    const base = {
        id: line.id, base_item_id: item.id, name: item.name, image: null, qty: line.quantity,
        observation: line.observation, selectedSubitems, promotion: item.promotion ?? undefined,
    };
    if (productsInLine.length > 1) {
        if (productsInLine.length > settings.max_flavors || productsInLine.some(product => !isPizzaItem(product, settings))) {
            throw new WhatsAppOrderError("Essa combinação de sabores não está disponível.");
        }
        assertPizzaCategoriesCanCombine(productsInLine, settings.same_category_only);
        const priced = pricePizza(productsInLine, selectedSubitems, settings.pricing_rule);
        return { ...base, ...priced, total_cents: priced.unit_price_cents * line.quantity, promotion: undefined };
    }
    const unit = Number(item.price_cents) + selectedSubitems.reduce((sum, option) => sum + option.price_cents * (option.quantity ?? 1), 0);
    return { ...base, unit_price_cents: unit, total_cents: unit * line.quantity };
}

const scheduleLabel = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
});

export async function quoteWhatsAppOrder(
    client: OrderDb, restaurant: CheckoutRestaurant, draft: WhatsAppOrderDraft, point: Coordinates | null, now = new Date(),
) {
    if (!draft.items.length) throw new WhatsAppOrderError("Adicione um produto à sacola.");
    if (!draft.name) throw new WhatsAppOrderError("Em nome de quem fica o pedido?");
    const { fee, time } = deliveryTerms(restaurant, draft, point);
    if (!draft.payment || !whatsappPaymentOptions(restaurant, draft.destination).some(option => option.method === draft.payment)) {
        throw new WhatsAppOrderError("Escolha uma forma de pagamento disponível.");
    }
    const scheduled = orderSchedule(restaurant, draft.schedule, now);
    const at = scheduled ?? now;
    const ids = [...new Set(draft.items.flatMap(line => line.itemIds))];
    const products = await loadWhatsAppOrderItems(client, restaurant.id, ids);
    const items = draft.items.map(line => priceWhatsAppLine(line, products, restaurant.pizza_settings, at));
    const subtotal = items.reduce((sum, item) => sum + (promotionPrice(item) ?? item.total_cents), 0);
    if (subtotal < Number(restaurant.min_order_cents || 0)) {
        throw new WhatsAppOrderError(`O pedido mínimo é ${formatPrice(restaurant.min_order_cents)}.`);
    }
    const pricing = await automaticOrderPricing(client, {
        restaurantId: restaurant.id, promotions: restaurant.automatic_promotions ?? [], items,
        subtotal_cents: subtotal, delivery_cents: fee, coupon_discount_cents: 0,
        channel: "delivery", pickup: draft.destination === "retirada", at, addGiftProducts: true,
    });
    const requested = new Map<string, number>();
    const gifts = [...new Set<string>(pricing.items.flatMap(pizzaStockItemIds))].filter(id => !products.has(id));
    for (const [id, item] of gifts.length ? await loadWhatsAppOrderItems(client, restaurant.id, gifts) : []) {
        products.set(id, item);
    }
    for (const item of pricing.items) {
        for (const id of pizzaStockItemIds(item)) requested.set(id, (requested.get(id) ?? 0) + item.qty);
    }
    for (const [id, quantity] of requested) {
        const product = products.get(id);
        if (!product?.is_available || !isItemAvailableForChannel(product, "entrega") ||
            !isCategoryAvailable(product.category?.availability_schedule, at) ||
            !isCategoryAvailable(product.availability_schedule, at)) {
            throw new WhatsAppOrderError(`${product?.name || "Um produto"} não está disponível para este horário.`);
        }
        if (product.stock_enabled && quantity > Number(product.stock_quantity)) {
            throw new WhatsAppOrderError(`Estoque insuficiente para ${product.name}. Ajuste a quantidade.`);
        }
    }
    const { promotion, total_cents, discount_cents } = pricing.result;
    const address = draft.destination === "entrega" ? draft.address : undefined;
    const customerAddress = address
        ? [fullAddress(address), address.complemento, address.referencia].filter(Boolean).join(" · ")
        : null;
    const body = {
        restaurantId: restaurant.id, items: pricing.items, customer_name: draft.name, customer_address: customerAddress,
        customer_address_details: address, is_delivery: draft.destination, scheduled_for: scheduled?.toISOString() ?? null,
        delivery_fee_cents: fee, delivery_time_minutes: time, paymentMethod: draft.payment,
        expected_promotion: { id: promotion?.id ?? null, total_cents },
    };
    // Compare everything the customer reviewed, including line prices and delivery terms.
    const hash = createHash("sha256").update(JSON.stringify({ body, promotion, discount_cents })).digest("hex");
    const summary = [
        "*Resumo do pedido*",
        ...(pricing.items as CartItem[]).map(item => {
            const options = item.selectedSubitems.map(option => `${option.quantity ?? 1}× ${option.subitemName}`);
            return [`${item.qty}× ${item.name} · ${formatPrice(promotionPrice(item) ?? item.total_cents)}`,
                options.join(", "), item.observation].filter(Boolean).join("\n");
        }),
        `Nome: ${draft.name}`,
        customerAddress ? `Entrega: ${customerAddress}` : "Retirada no restaurante",
        `Horário: ${scheduled ? scheduleLabel.format(scheduled) : `aprox. ${time} min`}`,
        `Subtotal: ${formatPrice(subtotal)}`,
        `Entrega: ${formatPrice(fee)}`,
        ...(discount_cents ? [`Desconto: ${formatPrice(discount_cents)}`] : []),
        `*Total: ${formatPrice(total_cents)}*`,
        `Pagamento: ${paymentLabel(draft.payment, draft.destination)}`,
    ].join("\n");
    return { hash, body, summary };
}
