import { formatPrice, promotionPrice } from "@/lib/utils/formatPrice";

export type PromotionRule =
  | { type: "weekdays"; days: number[] }
  | { type: "minimum"; cents: number; comparison: "gte" | "gt" }
  | { type: "product"; item_id: string; quantity: number };

export type PromotionBenefit =
  | { type: "delivery" }
  | { type: "percent"; value: number }
  | { type: "fixed"; cents: number }
  | { type: "product"; item_id: string; quantity: number };

export type AutomaticPromotion = {
  id: string;
  name: string;
  active: boolean;
  show_on_menu: boolean;
  delivery: boolean;
  mesa: boolean;
  allow_coupon: boolean;
  rules: PromotionRule[];
  benefits: PromotionBenefit[];
};

export type PromotionCartItem = {
  base_item_id: string;
  qty: number;
  unit_price_cents: number;
  total_cents: number;
  is_reward?: boolean;
  promotion?: any;
  selectedSubitems?: { price_cents: number; quantity?: number }[];
};

export type PromotionProduct = {
  id: string;
  name: string;
  price_cents: number;
  is_available: boolean;
  promotion?: any;
};

export type AppliedPromotion = {
  id: string;
  name: string;
  discount_cents: number;
  benefits: { label: string; discount_cents: number }[];
};

export type PromotionResult = {
  promotion: AppliedPromotion | null;
  coupon_discount_cents: number;
  discount_cents: number;
  total_cents: number;
  free_items?: {
    cart_index: number;
    quantity: number;
    discount_cents: number;
  }[];
};

export const WEEKDAYS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
export const PROMOTION_TIMEZONE = "America/Sao_Paulo";
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const positiveInteger = (value: unknown, max = 100_000_000) =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value > 0 &&
  value <= max;

export function validateAutomaticPromotion(value: unknown): string | null {
  const p = value as AutomaticPromotion;
  if (!p || typeof p !== "object" || !isUuid(p.id)) return "Promoção inválida.";
  if (typeof p.name !== "string" || !p.name.trim() || p.name.length > 80)
    return "Informe um nome de até 80 caracteres.";
  if (
    [p.active, p.show_on_menu, p.delivery, p.mesa, p.allow_coupon].some(
      (v) => typeof v !== "boolean",
    )
  )
    return "Configuração inválida.";
  if (!p.delivery && !p.mesa) return "Ative a promoção para Delivery ou Mesa.";
  if (!Array.isArray(p.rules) || p.rules.length > 20)
    return "Use até 20 regras.";
  if (
    !Array.isArray(p.benefits) ||
    !p.benefits.length ||
    p.benefits.length > 20
  )
    return "Adicione de 1 a 20 benefícios.";
  for (const rule of p.rules) {
    if (!rule || typeof rule !== "object") return "Regra inválida.";
    if (rule.type === "weekdays") {
      if (
        !Array.isArray(rule.days) ||
        !rule.days.length ||
        rule.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
      )
        return "Selecione os dias da semana.";
    } else if (rule.type === "minimum") {
      if (
        !positiveInteger(rule.cents) ||
        !["gte", "gt"].includes(rule.comparison)
      )
        return "Informe um valor mínimo válido.";
    } else if (rule.type === "product") {
      if (!isUuid(rule.item_id) || !positiveInteger(rule.quantity, 99))
        return "Selecione o produto e a quantidade da regra.";
    } else return "Tipo de regra inválido.";
  }
  for (const benefit of p.benefits) {
    if (!benefit || typeof benefit !== "object") return "Benefício inválido.";
    if (benefit.type === "percent") {
      if (
        typeof benefit.value !== "number" ||
        !Number.isFinite(benefit.value) ||
        benefit.value <= 0 ||
        benefit.value > 100
      )
        return "Informe um desconto entre 0 e 100%.";
    } else if (benefit.type === "fixed") {
      if (!positiveInteger(benefit.cents))
        return "Informe um desconto em reais válido.";
    } else if (benefit.type === "product") {
      if (!isUuid(benefit.item_id) || !positiveInteger(benefit.quantity, 99))
        return "Selecione o produto grátis e a quantidade.";
    } else if (benefit.type !== "delivery")
      return "Tipo de benefício inválido.";
  }
  return null;
}

export function parseAutomaticPromotions(value: unknown): AutomaticPromotion[] {
  return Array.isArray(value)
    ? value.filter((p) => !validateAutomaticPromotion(p))
    : [];
}

export function promotionAvailable(
  p: AutomaticPromotion,
  channel: "delivery" | "mesa",
  at = new Date(),
) {
  if (!p.active || !p[channel] || Number.isNaN(at.getTime())) return false;
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: PROMOTION_TIMEZONE,
  }).format(at);
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(day);
  return p.rules.every((r) => r.type !== "weekdays" || r.days.includes(index));
}

function joinTexts(values: string[]) {
  return values.length <= 1
    ? values.join("")
    : `${values.slice(0, -1).join(", ")} e ${values.at(-1)}`;
}

export function promotionDescription(
  p: AutomaticPromotion,
  products: Pick<PromotionProduct, "id" | "name">[],
) {
  const name = (id: string) =>
    products.find((p) => p.id === id)?.name || "produto indisponível";
  const rules = p.rules.map((r) =>
    r.type === "weekdays"
      ? r.days.length === 7
        ? "todos os dias"
        : joinTexts(
            [...new Set(r.days)]
              .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
              .map(
                (d) =>
                  [
                    "aos domingos",
                    "às segundas-feiras",
                    "às terças-feiras",
                    "às quartas-feiras",
                    "às quintas-feiras",
                    "às sextas-feiras",
                    "aos sábados",
                  ][d],
              ),
          )
      : r.type === "minimum"
        ? `em pedidos ${r.comparison === "gt" ? "acima de" : "a partir de"} ${formatPrice(r.cents)}`
        : `na compra de ${r.quantity}× ${name(r.item_id)}`,
  );
  const benefits = p.benefits.map((b) =>
    b.type === "delivery"
      ? "entrega grátis"
      : b.type === "percent"
        ? `${b.value.toLocaleString("pt-BR")}% de desconto`
        : b.type === "fixed"
          ? `${formatPrice(b.cents)} de desconto`
          : `${b.quantity}× ${name(b.item_id)} grátis`,
  );
  return {
    conditions: rules.length ? joinTexts(rules) : "todos os dias",
    benefits: joinTexts(benefits),
  };
}

// Same product-discount calculation as the existing checkout. Automatic offers
// add a separate discount; they never change the product-promotion records.
export function promotionCartSubtotal(items: PromotionCartItem[]) {
  return items.reduce(
    (sum, item) => sum + (promotionPrice(item) || item.total_cents),
    0,
  );
}

export function evaluateAutomaticPromotions(
  promotions: AutomaticPromotion[],
  input: {
    items: PromotionCartItem[];
    products: PromotionProduct[];
    subtotal_cents: number;
    delivery_cents: number;
    coupon_discount_cents: number;
    coupon_type?: string | null;
    channel: "delivery" | "mesa";
    pickup?: boolean;
    at?: Date;
  },
): PromotionResult {
  const subtotal = Math.max(0, Math.round(input.subtotal_cents));
  const delivery =
    input.channel === "mesa" || input.pickup
      ? 0
      : Math.max(0, Math.round(input.delivery_cents));
  const coupon =
    input.channel === "mesa" ||
    (input.pickup && input.coupon_type === "delivery")
      ? 0
      : Math.min(
          Math.max(0, Math.round(input.coupon_discount_cents)),
          subtotal,
        );
  let best: PromotionResult = {
    promotion: null,
    coupon_discount_cents: coupon,
    discount_cents: coupon,
    total_cents: Math.max(0, subtotal + delivery - coupon),
  };
  if (!input.items.some((i) => !i.is_reward && i.qty > 0)) return best;

  for (const p of promotions) {
    if (!promotionAvailable(p, input.channel, input.at)) continue;
    const paidItems = input.items.filter((i) => !i.is_reward);
    const quantities = new Map<string, number>();
    for (const item of paidItems)
      quantities.set(
        item.base_item_id || (item as any).item_id || (item as any).id,
        (quantities.get(item.base_item_id || (item as any).item_id || (item as any).id) || 0) + item.qty,
      );
    const required = new Map<string, number>();
    for (const rule of p.rules)
      if (rule.type === "product")
        required.set(
          rule.item_id,
          (required.get(rule.item_id) || 0) + rule.quantity,
        );
    if (
      [...required].some(
        ([id, qty]) =>
          (quantities.get(id) || 0) < qty ||
          !input.products.some((p) => p.id === id && p.is_available),
      )
    )
      continue;

    const applied: AppliedPromotion["benefits"] = [];
    const freeItems: NonNullable<PromotionResult["free_items"]> = [];
    const appliedCoupon = p.allow_coupon ? coupon : 0;
    const couponFromGoods =
      input.coupon_type === "delivery"
        ? Math.max(0, appliedCoupon - delivery)
        : Math.min(subtotal, appliedCoupon);
    let remainingSubtotal = Math.max(0, subtotal - couponFromGoods);
    let remainingDelivery = Math.max(
      0,
      delivery - (appliedCoupon - couponFromGoods),
    );
    let giftValue = 0;
    // Allocate free units across real cart lines. The base-price share keeps
    // selected extras paid and preserves existing product discounts/rounding.
    const reserved = new Map(required);
    const freeUnits = paidItems.map((item) => {
      const product = input.products.find(
        (p) => p.id === (item.base_item_id || (item as any).item_id || (item as any).id) && p.is_available,
      );
      const itemId = item.base_item_id || (item as any).item_id || (item as any).id;
      const skip = Math.min(item.qty, reserved.get(itemId) || 0);
      reserved.set(
        itemId,
        (reserved.get(itemId) || 0) - skip,
      );
      const lineTotal = Math.max(0, promotionPrice(item) || item.total_cents);
      const baseTotal =
        product && item.unit_price_cents > 0
          ? Math.min(
              lineTotal,
              Math.round(
                (lineTotal * product.price_cents) / item.unit_price_cents,
              ),
            )
          : 0;
      return {
        cart_index: input.items.indexOf(item),
        item_id: itemId,
        quantity: item.qty - skip,
        baseUnit: baseTotal / item.qty,
      };
    });
    for (const benefit of p.benefits) {
      if (benefit.type !== "product") continue;
      const product = input.products.find(
        (i) => i.id === benefit.item_id && i.is_available,
      );
      if (!product) continue;
      let quantity = 0;
      let rawValue = 0;
      const allocations: {
        cart_index: number;
        quantity: number;
        rawValue: number;
      }[] = [];
      for (const line of freeUnits) {
        if (line.item_id !== product.id) continue;
        const take = Math.min(benefit.quantity - quantity, line.quantity);
        line.quantity -= take;
        quantity += take;
        rawValue += line.baseUnit * take;
        if (take > 0)
          allocations.push({
            cart_index: line.cart_index,
            quantity: take,
            rawValue: line.baseUnit * take,
          });
      }
      giftValue += Math.round(rawValue);
      const value = Math.min(remainingSubtotal, Math.round(rawValue));
      if (quantity <= 0 || (value <= 0 && rawValue > 0)) continue;
      // Expose the same free-unit allocation to the cart without changing pricing.
      let allocated = 0;
      let cumulativeValue = 0;
      for (const allocation of allocations) {
        cumulativeValue += allocation.rawValue;
        const discount = Math.max(
          0,
          Math.min(value, Math.round(cumulativeValue)) - allocated,
        );
        allocated += discount;
        if (!discount && allocation.rawValue > 0) continue;
        const existing = freeItems.find(
          (item) => item.cart_index === allocation.cart_index,
        );
        if (existing) {
          existing.quantity += allocation.quantity;
          existing.discount_cents += discount;
        } else
          freeItems.push({
            cart_index: allocation.cart_index,
            quantity: allocation.quantity,
            discount_cents: discount,
          });
      }
      remainingSubtotal -= value;
      applied.push({
        label: `${quantity}× ${product.name} grátis`,
        discount_cents: value,
      });
    }

    // Minimum spend excludes the gifted base product, delivery and loyalty rewards.
    const qualifyingSubtotal = Math.max(0, subtotal - giftValue);
    if (
      p.rules.some(
        (r) =>
          r.type === "minimum" &&
          (r.comparison === "gt"
            ? qualifyingSubtotal <= r.cents
            : qualifyingSubtotal < r.cents),
      )
    )
      continue;
    const monetaryBenefits = [
      ...p.benefits.filter((b) => b.type === "fixed"),
      ...p.benefits.filter((b) => b.type === "percent"),
      ...p.benefits.filter((b) => b.type === "delivery"),
    ];
    for (const benefit of monetaryBenefits) {
      let value = 0;
      let label = "";
      if (benefit.type === "delivery") {
        value = remainingDelivery;
        remainingDelivery = 0;
        label = "Entrega grátis";
      }
      if (benefit.type === "fixed") {
        value = Math.min(remainingSubtotal, benefit.cents);
        remainingSubtotal -= value;
        label = `${formatPrice(benefit.cents)} de desconto`;
      }
      if (benefit.type === "percent") {
        value = Math.min(
          remainingSubtotal,
          Math.round((remainingSubtotal * benefit.value) / 100),
        );
        remainingSubtotal -= value;
        label = `${benefit.value.toLocaleString("pt-BR")}% de desconto`;
      }
      if (
        value > 0 ||
        (benefit.type === "delivery" &&
          input.channel === "delivery" &&
          !input.pickup &&
          !applied.some((b) => b.label === label))
      )
        applied.push({ label, discount_cents: value });
    }
    const promoDiscount = Math.min(
      applied.reduce((sum, b) => sum + b.discount_cents, 0),
      Math.max(0, subtotal + delivery - appliedCoupon),
    );
    const discount = appliedCoupon + promoDiscount;
    // A free product or delivery can already cost zero. It still applies,
    // but must never replace a better coupon or another automatic promotion.
    if (
      applied.length > 0 &&
      (discount > best.discount_cents ||
        (discount === best.discount_cents &&
          !best.promotion &&
          (coupon === 0 || p.allow_coupon)))
    )
      best = {
        promotion: {
          id: p.id,
          name: p.name,
          discount_cents: promoDiscount,
          benefits: applied,
        },
        coupon_discount_cents: appliedCoupon,
        discount_cents: discount,
        total_cents: Math.max(0, subtotal + delivery - discount),
        ...(freeItems.length ? { free_items: freeItems } : {}),
      };
  }
  return best;
}
