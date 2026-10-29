import { formatPrice, promotionPrice } from "@/lib/utils/formatPrice";

export type PromotionRule =
  | { type: "weekdays"; days: number[] }
  | { type: "minimum"; cents: number; comparison: "gte" | "gt" }
  | { type: "product"; item_id: string; quantity: number }
  | { type: "category"; category_id: string; quantity: number };

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
  pizza?: import("@/lib/types/types").PizzaSelection;
  base_item_id: string;
  qty: number;
  unit_price_cents: number;
  total_cents: number;
  is_reward?: boolean;
  automatic_promotion_id?: string;
  promotion?: any;
  selectedSubitems?: { price_cents: number; quantity?: number }[];
};

export type PromotionProduct = {
  id: string;
  name: string;
  price_cents: number;
  is_available: boolean;
  category_id?: string | null;
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
  free_products?: {
    item_id: string;
    name: string;
    quantity: number;
    unit_price_cents: number;
  }[];
};

export const WEEKDAYS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
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
    } else if (rule.type === "category") {
      if (!isUuid(rule.category_id) || !positiveInteger(rule.quantity, 99))
        return "Selecione a categoria e a quantidade da regra.";
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

function describePromotionDays(days: number[]) {
  const selected = [...new Set(days)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const labels = selected.map((day) => `${WEEKDAYS[day]}s`);
  if (selected.every((day) => day === 0 || day === 6))
    return `aos ${joinTexts(labels)}`;
  if (!selected.includes(0))
    return `às ${joinTexts(labels)}`;
  return `às ${joinTexts(selected.filter((day) => day !== 0).map((day) => `${WEEKDAYS[day]}s`))} e aos domingos`;
}

export function promotionDescription(
  p: AutomaticPromotion,
  products: Pick<PromotionProduct, "id" | "name">[],
  categories: { id: string; name: string }[] = [],
) {
  const name = (id: string) =>
    products.find((p) => p.id === id)?.name || "produto indisponível";
  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name || "categoria indisponível";
  const rules = p.rules.map((r) =>
    r.type === "weekdays"
      ? r.days.length === 7
        ? "todos os dias"
        : describePromotionDays(r.days)
      : r.type === "minimum"
        ? `em pedidos ${r.comparison === "gt" ? "acima de" : "a partir de"} ${formatPrice(r.cents)}`
        : r.type === "category"
          ? r.quantity === 1
            ? `para ${categoryName(r.category_id)}`
            : `na compra de ${r.quantity} produtos da categoria ${categoryName(r.category_id)}`
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
  const productLines = rules.filter((_, i) => p.rules[i].type === "product");
  const weekdays = rules.filter((_, i) => p.rules[i].type === "weekdays");
  return {
    conditions: productLines.length > 1
      ? [
          "na compra de",
          ...productLines.map((text) => text.replace(/^na compra de /, "")),
          ...rules.filter((_, i) => p.rules[i].type !== "product" && p.rules[i].type !== "weekdays"),
          ...weekdays,
        ].join("\n")
      : rules.length
        ? [
            joinTexts(rules.filter((_, i) => p.rules[i].type !== "weekdays")),
            joinTexts(weekdays),
          ].filter(Boolean).join(" ")
        : "todos os dias",
    benefits: joinTexts(benefits),
  };
}

// Same product-discount calculation as the existing checkout. Automatic offers
// add a separate discount; they never change the product-promotion records.
export function promotionCartSubtotal(items: PromotionCartItem[]) {
  return items.reduce(
    (sum, item) => sum + (promotionPrice(item) ?? item.total_cents),
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
  const rawSubtotal = Math.max(0, Math.round(input.subtotal_cents));
  const automaticGiftChargedSubtotal = input.items
    .filter((item) => Boolean(item.automatic_promotion_id))
    .reduce(
      (sum, item) => sum + Math.max(0, promotionPrice(item) ?? item.total_cents),
      0,
    );
  const subtotal = Math.max(0, rawSubtotal - automaticGiftChargedSubtotal);
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
  let bestValue = coupon;
  if (
    !input.items.some(
      (item) =>
        !item.is_reward && !item.automatic_promotion_id && item.qty > 0,
    )
  )
    return best;

  for (const p of promotions) {
    if (!promotionAvailable(p, input.channel, input.at)) continue;

    const paidItems = input.items.filter(
      (item) => !item.is_reward && !item.automatic_promotion_id,
    );
    const automaticGiftItems = input.items.filter(
      (item) =>
        !item.is_reward && item.automatic_promotion_id === p.id && item.qty > 0,
    );

    const quantities = new Map<string, number>();
    const categoryQuantities = new Map<string, number>();
    for (const item of paidItems) {
      if (item.pizza?.flavors.length) {
        const portion = item.qty / item.pizza.flavors.length;
        for (const flavor of item.pizza.flavors) {
          quantities.set(flavor.item_id, (quantities.get(flavor.item_id) || 0) + portion);
          const categoryId = input.products.find(
            (product) => product.id === flavor.item_id && product.is_available,
          )?.category_id;
          if (categoryId)
            categoryQuantities.set(
              categoryId, (categoryQuantities.get(categoryId) || 0) + portion,
            );
        }
        continue;
      }
      const itemId = item.base_item_id || (item as any).item_id || (item as any).id;
      quantities.set(itemId, (quantities.get(itemId) || 0) + item.qty);
      const categoryId = input.products.find(
        (product) => product.id === itemId && product.is_available,
      )?.category_id;
      if (categoryId)
        categoryQuantities.set(
          categoryId, (categoryQuantities.get(categoryId) || 0) + item.qty,
        );
    }

    const required = new Map<string, number>();
    const requiredCategories = new Map<string, number>();
    for (const rule of p.rules) {
      if (rule.type === "product") {
        required.set(
          rule.item_id,
          (required.get(rule.item_id) || 0) + rule.quantity,
        );
      } else if (rule.type === "category") {
        requiredCategories.set(
          rule.category_id,
          (requiredCategories.get(rule.category_id) || 0) + rule.quantity,
        );
      }
    }

    if (
      [...required].some(
        ([id, qty]) =>
          (quantities.get(id) || 0) + 1e-9 < qty ||
          !input.products.some((product) => product.id === id && product.is_available),
      ) ||
      [...requiredCategories].some(
        ([id, qty]) => (categoryQuantities.get(id) || 0) + 1e-9 < qty,
      )
    )
      continue;

    if (
      p.rules.some(
        (rule) =>
          rule.type === "minimum" &&
          (rule.comparison === "gt"
            ? subtotal <= rule.cents
            : subtotal < rule.cents),
      )
    )
      continue;

    const applied: AppliedPromotion["benefits"] = [];
    const freeItems: NonNullable<PromotionResult["free_items"]> = [];
    const freeProducts: NonNullable<PromotionResult["free_products"]> = [];
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
    let giftValueForSelection = 0;

    const giftUnits = automaticGiftItems.map((item) => ({
      cart_index: input.items.indexOf(item),
      item_id: item.base_item_id || (item as any).item_id || (item as any).id,
      quantity: item.qty,
      unit_price_cents: item.unit_price_cents,
    }));

    for (const benefit of p.benefits) {
      if (benefit.type !== "product") continue;
      const product = input.products.find(
        (item) => item.id === benefit.item_id && item.is_available,
      );
      if (!product) continue;

      let quantity = 0;
      for (const line of giftUnits) {
        if (line.item_id !== product.id || quantity >= benefit.quantity) continue;
        const take = Math.min(benefit.quantity - quantity, line.quantity);
        if (take <= 0) continue;
        line.quantity -= take;
        quantity += take;
        freeItems.push({
          cart_index: line.cart_index,
          quantity: take,
          discount_cents: Math.max(
            0,
            Math.round((line.unit_price_cents || product.price_cents) * take),
          ),
        });
      }

      const missingQuantity = Math.max(0, benefit.quantity - quantity);
      if (missingQuantity > 0) {
        freeProducts.push({
          item_id: product.id,
          name: product.name,
          quantity: missingQuantity,
          unit_price_cents: product.price_cents,
        });
        quantity += missingQuantity;
      }

      if (quantity <= 0) continue;
      giftValueForSelection += Math.max(0, product.price_cents * benefit.quantity);
      applied.push({
        label: `${benefit.quantity}× ${product.name} grátis`,
        discount_cents: 0,
      });
    }

    const monetaryBenefits = [
      ...p.benefits.filter((benefit) => benefit.type === "fixed"),
      ...p.benefits.filter((benefit) => benefit.type === "percent"),
      ...p.benefits.filter((benefit) => benefit.type === "delivery"),
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
          !applied.some((entry) => entry.label === label))
      )
        applied.push({ label, discount_cents: value });
    }

    const promoDiscount = Math.min(
      applied.reduce((sum, benefit) => sum + benefit.discount_cents, 0),
      Math.max(0, subtotal + delivery - appliedCoupon),
    );
    const discount = appliedCoupon + promoDiscount;
    const selectionValue = discount + giftValueForSelection;

    if (
      applied.length > 0 &&
      (selectionValue > bestValue ||
        (selectionValue === bestValue &&
          !best.promotion &&
          (coupon === 0 || p.allow_coupon)))
    ) {
      bestValue = selectionValue;
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
        ...(freeProducts.length ? { free_products: freeProducts } : {}),
      };
    }
  }

  return best;
}
