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

const UUID_SCHEMA = {
  type: "string",
  pattern:
    "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
};
const availabilitySlotSchema = {
  type: "object",
  properties: {
    open: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
    close: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
  },
  required: ["open", "close"],
  additionalProperties: false,
};
const automaticPromotionRuleSchema = {
  oneOf: [
    {
      type: "object",
      properties: {
        type: { type: "string", enum: ["weekdays"] },
        days: {
          type: "array",
          minItems: 1,
          maxItems: 7,
          items: { type: "integer", minimum: 0, maximum: 6 },
        },
      },
      required: ["type", "days"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { type: "string", enum: ["minimum"] },
        cents: { type: "integer", minimum: 1, maximum: 100000000 },
        comparison: { type: "string", enum: ["gte", "gt"] },
      },
      required: ["type", "cents", "comparison"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { type: "string", enum: ["product"] },
        item_id: UUID_SCHEMA,
        quantity: { type: "integer", minimum: 1, maximum: 99 },
      },
      required: ["type", "item_id", "quantity"],
      additionalProperties: false,
    },
  ],
};
const automaticPromotionBenefitSchema = {
  oneOf: [
    {
      type: "object",
      properties: { type: { type: "string", enum: ["delivery"] } },
      required: ["type"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { type: "string", enum: ["percent"] },
        value: { type: "number", exclusiveMinimum: 0, maximum: 100 },
      },
      required: ["type", "value"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { type: "string", enum: ["fixed"] },
        cents: { type: "integer", minimum: 1, maximum: 100000000 },
      },
      required: ["type", "cents"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { type: "string", enum: ["product"] },
        item_id: UUID_SCHEMA,
        quantity: { type: "integer", minimum: 1, maximum: 99 },
      },
      required: ["type", "item_id", "quantity"],
      additionalProperties: false,
    },
  ],
};
const ACTION_SPECIAL_SCHEMAS: Record<string, Data> = {
  availability_json: {
    type: "object",
    description:
      "Agenda semanal completa. Atualizar substitui a agenda inteira: leia restaurants antes e preserve todos os horários não alterados. Chaves: 0=domingo, 1=segunda, 2=terça, 3=quarta, 4=quinta, 5=sexta, 6=sábado.",
    properties: Object.fromEntries(
      Array.from({ length: 7 }, (_, day) => [
        String(day),
        { type: "array", items: availabilitySlotSchema },
      ]),
    ),
    required: ["0", "1", "2", "3", "4", "5", "6"],
    additionalProperties: false,
  },
  allowed_payment_methods: {
    type: "array",
    items: {
      type: "string",
      enum: ["pix", "dinheiro", "trazer-maquininha"],
    },
    maxItems: 3,
  },
  delivery_fee_mode: {
    type: "string",
    enum: ["radius", "neighborhood"],
  },
  delivery_fee_json: {
    type: "array",
    description:
      "Tabela completa de entrega por raio. Atualizar substitui a lista inteira; preserve entradas não alteradas.",
    maxItems: 200,
    items: {
      type: "object",
      properties: {
        radius_km: { type: "number", exclusiveMinimum: 0, maximum: 500 },
        time_minutes: { type: "number", minimum: 0, maximum: 1440 },
        fee_cents: {
          anyOf: [
            { type: "integer", minimum: 0 },
            { type: "null" },
          ],
        },
      },
      required: ["radius_km", "time_minutes"],
      additionalProperties: false,
    },
  },
  delivery_neighborhood_fee_json: {
    type: "array",
    description:
      "Tabela completa de entrega por bairro. Atualizar substitui a lista inteira; preserve entradas não alteradas.",
    maxItems: 200,
    items: {
      type: "object",
      properties: {
        neighborhood: { type: "string", minLength: 1 },
        time_minutes: { type: "number", minimum: 0, maximum: 1440 },
        fee_cents: {
          anyOf: [
            { type: "integer", minimum: 0 },
            { type: "null" },
          ],
        },
      },
      required: ["neighborhood", "time_minutes"],
      additionalProperties: false,
    },
  },
  automatic_promotions: {
    type: "array",
    description:
      "Lista completa de promoções automáticas. Atualizar substitui a lista inteira; preserve promoções não alteradas.",
    maxItems: 30,
    items: {
      type: "object",
      properties: {
        id: UUID_SCHEMA,
        name: { type: "string", minLength: 1, maxLength: 80 },
        active: { type: "boolean" },
        show_on_menu: { type: "boolean" },
        delivery: { type: "boolean" },
        mesa: { type: "boolean" },
        allow_coupon: { type: "boolean" },
        rules: {
          type: "array",
          maxItems: 20,
          items: automaticPromotionRuleSchema,
        },
        benefits: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: automaticPromotionBenefitSchema,
        },
      },
      required: [
        "id",
        "name",
        "active",
        "show_on_menu",
        "delivery",
        "mesa",
        "allow_coupon",
        "rules",
        "benefits",
      ],
      additionalProperties: false,
    },
  },
  pizza_settings: {
    type: "object",
    description:
      "Configuração completa de pizza. Atualizar substitui o objeto inteiro.",
    properties: {
      enabled: { type: "boolean" },
      pricing_rule: { type: "string", enum: ["highest", "average"] },
      max_flavors: { type: "integer", minimum: 2, maximum: 8 },
      category_ids: { type: "array", items: UUID_SCHEMA },
    },
    required: ["enabled", "pricing_rule", "max_flavors", "category_ids"],
    additionalProperties: false,
  },
  available_days: {
    type: "array",
    items: { type: "integer", minimum: 0, maximum: 6 },
    maxItems: 7,
  },
  origins: {
    type: "array",
    items: {
      type: "string",
      enum: ["delivery", "retirada", "autoatendimento"],
    },
    maxItems: 3,
  },
  discount_type: {
    type: "string",
    enum: ["percent", "fixed", "delivery"],
  },
  type: { type: "string", enum: ["percent", "fixed"] },
  reward_subitem_ids: {
    type: "array",
    description:
      "Lista completa dos complementos da recompensa; todos devem pertencer ao reward_item_id.",
    items: UUID_SCHEMA,
    maxItems: 100,
  },
  message_templates: {
    type: "object",
    description:
      "Objeto completo de modelos do Robô WhatsApp. Atualizar substitui o objeto inteiro; preserve modelos não alterados.",
    properties: Object.fromEntries(
      [
        "welcome",
        "menu_link",
        "delivery",
        "payment",
        "order_status_found",
        "handoff",
        "order_tracking",
        "status_notification",
      ].map((name) => [name, { type: "string", maxLength: 4000 }]),
    ),
    additionalProperties: false,
  },
};

function actionFieldSchema(
  name: string,
  definition: { type: string; nullable: boolean },
): Data {
  const special = ACTION_SPECIAL_SCHEMAS[name];
  let schema: Data;
  if (special) schema = special;
  else if (definition.type === "boolean") schema = { type: "boolean" };
  else if (definition.type === "uuid") schema = UUID_SCHEMA;
  else if (["integer", "smallint"].includes(definition.type))
    schema = { type: "integer", minimum: 0, maximum: 100000000 };
  else if (["real", "numeric"].includes(definition.type))
    schema = { type: "number", minimum: 0, maximum: 100000000 };
  else if (definition.type.startsWith("time "))
    schema = {
      type: "string",
      pattern: "^\\d{2}:\\d{2}(:\\d{2})?$",
    };
  else if (definition.type === "date")
    schema = {
      type: "string",
      pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    };
  else if (definition.type.includes("timestamp"))
    schema = {
      type: "string",
      description: "Data e hora em formato ISO 8601.",
    };
  else schema = { type: "string", maxLength: 6000 };
  return definition.nullable
    ? { anyOf: [schema, { type: "null" }] }
    : schema;
}

export function actionValuesSchema(): Data {
  const properties: Data = {};
  for (const entity of Object.keys(FIELDS) as (keyof typeof FIELDS)[])
    for (const [name, definition] of Object.entries(FIELDS[entity]))
      if (!properties[name])
        properties[name] = actionFieldSchema(name, definition);
  return {
    type: "object",
    description:
      "Use somente campos pertencentes à entidade escolhida em Campos disponíveis. Campos JSON de configuração substituem o valor inteiro; leia o estado atual e preserve tudo que o usuário não pediu para mudar.",
    properties,
    additionalProperties: false,
  };
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
  if (
    value.reward_subitem_ids != null &&
    (!Array.isArray(value.reward_subitem_ids) ||
      value.reward_subitem_ids.length > 100 ||
      !value.reward_subitem_ids.every(isUuid))
  )
    throw new SalesError("Complementos da recompensa inválidos.");
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
