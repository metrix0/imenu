/** Explicit commercial fields; account data, credentials and order history are never exposed. */
export const FIELDS = {
  restaurants: {
    name: {
      type: "text",
      nullable: true,
      required: false,
    },
    description: {
      type: "text",
      nullable: true,
      required: false,
    },
    logo_url: {
      type: "text",
      nullable: true,
      required: false,
    },
    banner_url: {
      type: "text",
      nullable: true,
      required: false,
    },
    url_slug: {
      type: "text",
      nullable: true,
      required: false,
    },
    min_order_cents: {
      type: "real",
      nullable: true,
      required: false,
    },
    availability_json: {
      type: "jsonb",
      nullable: true,
      required: false,
    },
    is_closed: {
      type: "timestamp without time zone",
      nullable: true,
      required: false,
    },
    pickup_enabled: {
      type: "boolean",
      nullable: false,
      required: false,
    },
    allowed_payment_methods: {
      type: "ARRAY",
      nullable: false,
      required: false,
    },
    prep_time_min_minutes: {
      type: "integer",
      nullable: true,
      required: false,
    },
    prep_time_max_minutes: {
      type: "integer",
      nullable: true,
      required: false,
    },
    prep_time_source: {
      type: "text",
      nullable: true,
      required: false,
    },
    force_whatsapp_order_confirmation: {
      type: "boolean",
      nullable: false,
      required: false,
    },
    allow_future_order_scheduling: {
      type: "boolean",
      nullable: false,
      required: false,
    },
    delivery_fee_mode: {
      type: "text",
      nullable: false,
      required: false,
    },
    delivery_fee_json: {
      type: "jsonb",
      nullable: true,
      required: false,
    },
    delivery_neighborhood_fee_json: {
      type: "jsonb",
      nullable: false,
      required: false,
    },
    automatic_promotions: {
      type: "jsonb",
      nullable: false,
      required: false,
    },
    pizza_settings: {
      type: "jsonb",
      nullable: false,
      required: false,
    },
  },
  categories: {
    name: {
      type: "text",
      nullable: false,
      required: true,
    },
    position: {
      type: "integer",
      nullable: false,
      required: false,
    },
  },
  items: {
    category_id: {
      type: "uuid",
      nullable: false,
      required: true,
    },
    name: {
      type: "text",
      nullable: false,
      required: true,
    },
    description: {
      type: "text",
      nullable: true,
      required: false,
    },
    price_cents: {
      type: "integer",
      nullable: false,
      required: true,
    },
    image_path: {
      type: "text",
      nullable: true,
      required: false,
    },
    is_available: {
      type: "boolean",
      nullable: false,
      required: false,
    },
    position: {
      type: "integer",
      nullable: false,
      required: false,
    },
    stock_enabled: {
      type: "boolean",
      nullable: false,
      required: false,
    },
    stock_quantity: {
      type: "integer",
      nullable: true,
      required: false,
    },
  },
  item_subcategories: {
    item_id: {
      type: "uuid",
      nullable: false,
      required: true,
    },
    name: {
      type: "text",
      nullable: false,
      required: true,
    },
    description: {
      type: "text",
      nullable: true,
      required: false,
    },
    position: {
      type: "integer",
      nullable: false,
      required: false,
    },
    min_select: {
      type: "integer",
      nullable: false,
      required: false,
    },
    max_select: {
      type: "integer",
      nullable: false,
      required: false,
    },
    allow_multiple_units: {
      type: "boolean",
      nullable: false,
      required: false,
    },
  },
  subitems: {
    item_subcategory_id: {
      type: "uuid",
      nullable: false,
      required: true,
    },
    name: {
      type: "text",
      nullable: false,
      required: true,
    },
    description: {
      type: "text",
      nullable: true,
      required: false,
    },
    price_cents: {
      type: "integer",
      nullable: false,
      required: true,
    },
    is_available: {
      type: "boolean",
      nullable: false,
      required: false,
    },
    position: {
      type: "integer",
      nullable: false,
      required: false,
    },
  },
  upsell: {
    item_id: {
      type: "uuid",
      nullable: false,
      required: true,
    },
    position: {
      type: "integer",
      nullable: false,
      required: false,
    },
  },
  promotions: {
    item_id: {
      type: "uuid",
      nullable: false,
      required: true,
    },
    type: {
      type: "text",
      nullable: false,
      required: true,
    },
    value: {
      type: "numeric",
      nullable: false,
      required: true,
    },
    starts_at: {
      type: "timestamp with time zone",
      nullable: false,
      required: false,
    },
    ends_at: {
      type: "timestamp with time zone",
      nullable: false,
      required: false,
    },
    active: {
      type: "boolean",
      nullable: false,
      required: false,
    },
  },
  coupons: {
    code: {
      type: "text",
      nullable: false,
      required: true,
    },
    discount_type: {
      type: "text",
      nullable: false,
      required: true,
    },
    discount_value: {
      type: "numeric",
      nullable: false,
      required: true,
    },
    max_discount_value: {
      type: "numeric",
      nullable: true,
      required: false,
    },
    min_order_value: {
      type: "numeric",
      nullable: true,
      required: false,
    },
    quantity: {
      type: "integer",
      nullable: true,
      required: false,
    },
    unlimited_quantity: {
      type: "boolean",
      nullable: true,
      required: false,
    },
    start_date: {
      type: "date",
      nullable: false,
      required: true,
    },
    end_date: {
      type: "date",
      nullable: false,
      required: true,
    },
    available_days: {
      type: "ARRAY",
      nullable: true,
      required: false,
    },
    start_time: {
      type: "time without time zone",
      nullable: true,
      required: false,
    },
    end_time: {
      type: "time without time zone",
      nullable: true,
      required: false,
    },
    origins: {
      type: "ARRAY",
      nullable: true,
      required: false,
    },
    active: {
      type: "boolean",
      nullable: true,
      required: false,
    },
    show_coupon: {
      type: "boolean",
      nullable: false,
      required: false,
    },
    one_coupon_per_user: {
      type: "boolean",
      nullable: true,
      required: false,
    },
  },
  loyalty_programs: {
    goal_count: {
      type: "integer",
      nullable: false,
      required: false,
    },
    reward_description: {
      type: "text",
      nullable: true,
      required: false,
    },
    active: {
      type: "boolean",
      nullable: true,
      required: false,
    },
    min_order_value_cents: {
      type: "integer",
      nullable: true,
      required: false,
    },
    reward_item_id: {
      type: "uuid",
      nullable: true,
      required: false,
    },
    reward_subitem_ids: {
      type: "jsonb",
      nullable: true,
      required: false,
    },
  },
  restaurant_tables: {
    name: {
      type: "text",
      nullable: false,
      required: true,
    },
    position: {
      type: "integer",
      nullable: false,
      required: false,
    },
    is_active: {
      type: "boolean",
      nullable: false,
      required: false,
    },
  },
  tracking_integrations: {
    ga4_id: {
      type: "text",
      nullable: true,
      required: false,
    },
    gtm_id: {
      type: "text",
      nullable: true,
      required: false,
    },
    meta_pixel_id: {
      type: "text",
      nullable: true,
      required: false,
    },
    is_enabled: {
      type: "boolean",
      nullable: false,
      required: false,
    },
  },
  whatsapp_bot_settings: {
    message_templates: {
      type: "jsonb",
      nullable: false,
      required: false,
    },
  },
  menu: {
    name: {
      type: "text",
      nullable: false,
      required: true,
    },
    description: {
      type: "text",
      nullable: true,
      required: false,
    },
    is_active: {
      type: "boolean",
      nullable: false,
      required: false,
    },
  },
} as const;
