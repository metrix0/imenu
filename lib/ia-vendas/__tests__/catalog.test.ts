import { actionValuesSchema, validate } from "../catalog";
import { FIELDS } from "../fields";

const uuid = "11111111-1111-4111-8111-111111111111";
const week = {
  "0": [{ open: "01:00", close: "03:00" }],
  "1": [],
  "2": [],
  "3": [],
  "4": [],
  "5": [],
  "6": [],
};
const samples: Record<string, unknown> = {
  name: "Teste",
  description: "Descrição",
  logo_url: "https://example.com/logo.png",
  banner_url: "https://example.com/banner.png",
  url_slug: "teste",
  min_order_cents: 100,
  availability_json: week,
  is_closed: "2026-10-04T18:00:00",
  pickup_enabled: true,
  allowed_payment_methods: ["pix"],
  prep_time_min_minutes: 10,
  prep_time_max_minutes: 20,
  prep_time_source: "manual",
  force_whatsapp_order_confirmation: true,
  allow_future_order_scheduling: true,
  delivery_fee_mode: "radius",
  delivery_fee_json: [{ radius_km: 5, time_minutes: 30, fee_cents: 500 }],
  delivery_neighborhood_fee_json: [
    { neighborhood: "Centro", time_minutes: 20, fee_cents: 400 },
  ],
  automatic_promotions: [
    {
      id: uuid,
      name: "Promo",
      active: true,
      show_on_menu: true,
      delivery: true,
      mesa: false,
      allow_coupon: false,
      rules: [{ type: "weekdays", days: [0] }],
      benefits: [{ type: "percent", value: 10 }],
    },
  ],
  pizza_settings: {
    enabled: true,
    pricing_rule: "highest",
    max_flavors: 2,
    category_ids: [uuid],
  },
  category_id: uuid,
  price_cents: 1000,
  image_path: "items/teste.png",
  is_available: true,
  position: 1,
  stock_enabled: true,
  stock_quantity: 5,
  item_id: uuid,
  min_select: 0,
  max_select: 2,
  allow_multiple_units: true,
  item_subcategory_id: uuid,
  type: "percent",
  value: 10,
  starts_at: "2026-10-04T18:00:00Z",
  ends_at: "2026-10-05T18:00:00Z",
  active: true,
  code: "TESTE",
  discount_type: "percent",
  discount_value: 0.1,
  max_discount_value: 10,
  min_order_value: 20,
  quantity: 10,
  unlimited_quantity: false,
  start_date: "2026-10-04",
  end_date: "2026-10-05",
  available_days: [0, 1],
  start_time: "01:00",
  end_time: "03:00",
  origins: ["delivery"],
  show_coupon: true,
  one_coupon_per_user: false,
  goal_count: 10,
  reward_description: "Produto grátis",
  min_order_value_cents: 1000,
  reward_item_id: uuid,
  reward_subitem_ids: [uuid],
  ga4_id: "G-TEST",
  gtm_id: "GTM-TEST",
  meta_pixel_id: "123",
  is_enabled: true,
  message_templates: { welcome: "Olá" },
  is_active: true,
};

test("propose_action schema exposes every editable field with its real shape", () => {
  const schema = actionValuesSchema() as any;
  for (const [entity, definitions] of Object.entries(FIELDS))
    for (const field of Object.keys(definitions)) {
      expect(schema.properties[field]).toBeDefined();
      expect(samples).toHaveProperty(field);
      expect(() =>
        validate(entity, { [field]: samples[field] }),
      ).not.toThrow();
    }
});

test("operating-hours proposals require the full seven-day schedule and HH:MM slots", () => {
  const schema = actionValuesSchema() as any;
  const availability = schema.properties.availability_json.anyOf[0];

  expect(availability.required).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
  expect(availability.properties["0"].items.required).toEqual(["open", "close"]);
  expect(validate("restaurants", { availability_json: week })).toEqual({
    availability_json: week,
  });
});

test("structured proposal fields reject malformed shapes instead of crashing later", () => {
  expect(() =>
    validate("loyalty_programs", { reward_subitem_ids: { bad: uuid } }),
  ).toThrow("Complementos da recompensa inválidos.");
  expect(() =>
    validate("restaurants", {
      availability_json: { "0": [{ open: "03:00", close: "01:00" }] },
    }),
  ).toThrow("Horário inválido.");
});
