import { FIELDS } from "./fields";
import { object, SalesError, type Data } from "./types";
import { isUuid, validateAutomaticPromotion } from "@/lib/promotions/automatic";
export { isUuid };
export const SINGLETONS = [
  "restaurants",
  "loyalty_programs",
  "tracking_integrations",
  "whatsapp_bot_settings",
];
export const PARENTS: Record<string, Record<string, string>> = {
  items: { category_id: "categories" },
  item_subcategories: { item_id: "items" },
  subitems: { item_subcategory_id: "item_subcategories" },
  upsell: { item_id: "items" },
  promotions: { item_id: "items" },
  loyalty_programs: { reward_item_id: "items" },
};
export function fields(
  entity: string,
): Record<string, { type: string; nullable: boolean; required: boolean }> {
  if (!Object.hasOwn(FIELDS, entity))
    throw new SalesError("Esta área não pode ser alterada pela IA.");
  return FIELDS[entity as keyof typeof FIELDS];
}
export const key = (e: string) =>
  e === "whatsapp_bot_settings" ? "restaurant_id" : "id";
export function scope(entity: string, alias = "t"): string {
  fields(entity);
  if (entity === "restaurants") return `${alias}.id=$1`;
  if (entity === "item_subcategories")
    return `EXISTS (SELECT 1 FROM public.items p WHERE p.id=${alias}.item_id AND p.restaurant_id=$1)`;
  if (entity === "subitems")
    return `EXISTS (SELECT 1 FROM public.item_subcategories g JOIN public.items p ON p.id=g.item_id WHERE g.id=${alias}.item_subcategory_id AND p.restaurant_id=$1)`;
  return `${alias}.restaurant_id=$1`;
}
export function validate(entity: string, input: unknown, create = false): Data {
  const defs = fields(entity),
    value = object(input);
  if (!Object.keys(value).length || JSON.stringify(value).length > 60000)
    throw new SalesError("Alteração vazia ou muito grande.");
  for (const [name, v] of Object.entries(value)) {
    const d = defs[name];
    if (!Object.hasOwn(defs, name))
      throw new SalesError(`Campo não permitido: ${name}.`);
    if (v === null) {
      if (!d.nullable) throw new SalesError(`${name} é obrigatório.`);
      continue;
    }
    if (d.type === "boolean" && typeof v !== "boolean")
      throw new SalesError(`${name}: use verdadeiro ou falso.`);
    if (
      ["integer", "real", "numeric", "smallint"].includes(d.type) &&
      (typeof v !== "number" ||
        !Number.isFinite(v) ||
        v < 0 ||
        v > 100000000 ||
        (["integer", "smallint"].includes(d.type) && !Number.isSafeInteger(v)))
    )
      throw new SalesError(`${name}: número inválido.`);
    if (d.type === "uuid" && !isUuid(v))
      throw new SalesError(`${name}: identificador inválido.`);
    if (d.type === "text" && (typeof v !== "string" || v.length > 6000))
      throw new SalesError(`${name}: texto inválido.`);
    if (d.type === "ARRAY" && (!Array.isArray(v) || v.length > 100))
      throw new SalesError(`${name}: lista inválida.`);
    if (
      (d.type.includes("timestamp") || d.type === "date") &&
      (typeof v !== "string" || !Number.isFinite(Date.parse(v)))
    )
      throw new SalesError(`${name}: data inválida.`);
    if (d.type.startsWith("time ") && !/^\d{2}:\d{2}(:\d{2})?$/.test(v))
      throw new SalesError("Horário inválido.");
    if (["name", "code"].includes(name) && !String(v).trim())
      throw new SalesError("Informe um nome.");
    if (
      ["image_path", "logo_url", "banner_url"].includes(name) &&
      v &&
      !/^https:\/\//.test(v) &&
      !/^[a-zA-Z0-9_/-]+\.(png|jpg|jpeg|webp)$/.test(v)
    )
      throw new SalesError("Imagem inválida.");
  }
  if (create)
    for (const [name, d] of Object.entries(defs))
      if (d.required && value[name] == null)
        throw new SalesError(`Informe ${name}.`);
  if (value.url_slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.url_slug))
    throw new SalesError("Link público inválido.");
  if (
    value.allowed_payment_methods &&
    value.allowed_payment_methods.some(
      (x: string) => !["pix", "dinheiro", "trazer-maquininha"].includes(x),
    )
  )
    throw new SalesError("Forma de pagamento inválida.");
  if (
    value.origins &&
    value.origins.some(
      (x: string) => !["delivery", "retirada", "autoatendimento"].includes(x),
    )
  )
    throw new SalesError("Canal inválido.");
  if (
    value.available_days &&
    value.available_days.some(
      (x: number) => !Number.isInteger(x) || x < 0 || x > 6,
    )
  )
    throw new SalesError("Dia inválido.");
  if (
    value.delivery_fee_mode &&
    !["radius", "neighborhood"].includes(value.delivery_fee_mode)
  )
    throw new SalesError("Modo de entrega inválido.");
  for (const field of ["delivery_fee_json", "delivery_neighborhood_fee_json"])
    if (value[field] != null) {
      if (!Array.isArray(value[field]) || value[field].length > 200)
        throw new SalesError("Taxas de entrega inválidas.");
      for (const row of value[field]) {
        object(row);
        if (
          !Number.isFinite(row.time_minutes) ||
          row.time_minutes < 0 ||
          row.time_minutes > 1440 ||
          (row.fee_cents != null &&
            (!Number.isInteger(row.fee_cents) || row.fee_cents < 0))
        )
          throw new SalesError("Taxa ou prazo inválido.");
        if (
          field === "delivery_fee_json" &&
          (!Number.isFinite(row.radius_km) ||
            row.radius_km <= 0 ||
            row.radius_km > 500)
        )
          throw new SalesError("Raio inválido.");
        if (
          field.includes("neighborhood") &&
          (typeof row.neighborhood !== "string" || !row.neighborhood.trim())
        )
          throw new SalesError("Bairro obrigatório.");
      }
    }
  if (value.availability_json != null)
    for (const [day, slots] of Object.entries(
      object(value.availability_json),
    )) {
      if (!/^[0-6]$/.test(day) || !Array.isArray(slots))
        throw new SalesError("Horários inválidos.");
      for (const slot of slots)
        if (
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.open) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.close) ||
          slot.open >= slot.close
        )
          throw new SalesError("Horário inválido.");
    }
  if (value.automatic_promotions != null) {
    if (
      !Array.isArray(value.automatic_promotions) ||
      value.automatic_promotions.length > 30
    )
      throw new SalesError("Promoções inválidas.");
    for (const p of value.automatic_promotions) {
      const error = validateAutomaticPromotion(p);
      if (error) throw new SalesError(error);
    }
  }
  if (value.pizza_settings != null) {
    const p = object(value.pizza_settings);
    if (
      typeof p.enabled !== "boolean" ||
      !["highest", "average"].includes(p.pricing_rule) ||
      !Number.isInteger(p.max_flavors) ||
      p.max_flavors < 2 ||
      p.max_flavors > 8 ||
      !Array.isArray(p.category_ids) ||
      !p.category_ids.every(isUuid)
    )
      throw new SalesError("Configuração de pizza inválida.");
  }
  if (value.message_templates != null) {
    const allowed = [
      "welcome",
      "menu_link",
      "delivery",
      "payment",
      "order_status_found",
      "handoff",
      "order_tracking",
      "status_notification",
    ];
    for (const [k, v] of Object.entries(object(value.message_templates)))
      if (!allowed.includes(k) || typeof v !== "string" || v.length > 4000)
        throw new SalesError("Modelo de mensagem inválido.");
  }
  return value;
}
export function validateMerged(entity: string, v: Data) {
  if (
    entity === "promotions" &&
    (!["percent", "fixed"].includes(v.type) ||
      Number(v.value) <= 0 ||
      (v.type === "percent" && Number(v.value) > 100))
  )
    throw new SalesError("Desconto inválido.");
  if (
    entity === "coupons" &&
    (!["percent", "fixed", "delivery"].includes(v.discount_type) ||
      (v.discount_type !== "delivery" && Number(v.discount_value) <= 0) ||
      (v.discount_type === "percent" && Number(v.discount_value) > 1))
  )
    throw new SalesError("Cupom percentual usa fração: 0,10 = 10%.");
  if (entity === "item_subcategories" && v.min_select > v.max_select)
    throw new SalesError("Mínimo maior que máximo.");
  if (
    entity === "loyalty_programs" &&
    (v.goal_count < 1 || v.goal_count > 100 || (v.active && !v.reward_item_id))
  )
    throw new SalesError("Configure a meta e a recompensa.");
  if (
    v.prep_time_min_minutes != null &&
    v.prep_time_max_minutes != null &&
    v.prep_time_min_minutes > v.prep_time_max_minutes
  )
    throw new SalesError("Prazo mínimo maior que máximo.");
  for (const [a, b] of [
    ["start_date", "end_date"],
    ["starts_at", "ends_at"],
  ])
    if (v[a] && v[b] && new Date(v[a]) > new Date(v[b]))
      throw new SalesError("O término deve ser posterior ao início.");
}
