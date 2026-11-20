import { getPublicItemMedia } from "@/lib/menu/itemMedia";
import { getMenuItemImageUrl } from "@/lib/menu/itemImages";
import { isItemAvailableForChannel } from "@/lib/menu/itemAvailability";
// app/[slug]/page.tsx

import { notFound } from "next/navigation";
import Image from "next/image";
import MenuClientPage from "./menu-client";
import StartingPriceLabels from "./StartingPriceLabels";
import {
  Category,
  Item,
  ItemsByCategory,
  Restaurant,
} from "@/lib/types/types";
import TrackingScripts from "@/components/costumer/TrackingScripts";
import { cleanMetaPixelId } from "@/lib/analytics/metaEvents";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import PickupAvailabilityGuard from "./PickupAvailabilityGuard";

import { query } from "@/lib/database/sql";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { getPublicMenuRestaurant } from "./restaurant-data";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import type {
  QrTableMenuContext,
} from "@/lib/qr-table/types";

const getPublicUrl = (supabase: any, bucket: string, path: string | null) => {
  if (!path) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
};

const getStoreWhatsapp = (value: unknown) => {
  const rawDigits = String(value ?? "").replace(/\D/g, "");

  if (!rawDigits) {
    return null;
  }

  const localDigits =
    rawDigits.startsWith("55") &&
    (rawDigits.length === 12 || rawDigits.length === 13)
      ? rawDigits.slice(2)
      : rawDigits;

  if (localDigits.length !== 10 && localDigits.length !== 11) {
    return null;
  }

  const linkDigits = `55${localDigits}`;
  const formatted =
    localDigits.length === 11
      ? `(${localDigits.slice(0, 2)}) ${localDigits.slice(
          2,
          7,
        )}-${localDigits.slice(7)}`
      : `(${localDigits.slice(0, 2)}) ${localDigits.slice(
          2,
          6,
        )}-${localDigits.slice(6)}`;

  return {
    href: `https://wa.me/${linkDigits}`,
    formatted,
  };
};

type AvailabilitySlot = {
  open: string;
  close: string;
};

const normalizeEndOfDayAvailability = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([day, slots]) => [
      day,
      Array.isArray(slots)
        ? slots.map((slot) => {
            if (!slot || typeof slot !== "object" || Array.isArray(slot)) {
              return slot;
            }

            const typedSlot = slot as AvailabilitySlot;
            return {
              ...typedSlot,
              close:
                typedSlot.close === "00:00" || typedSlot.close === "24:00"
                  ? "23:59"
                  : typedSlot.close,
            };
          })
        : slots,
    ]),
  );
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    p?: string;
    c?: string;
    origem?: string;
    mesa?: string;
  }>;
}) {
  const { slug } = await params;
  const p = await searchParams;

  const supabase = createSupabaseServerClient();

  // --- 1. Restaurante ---
  const restaurantData = await getPublicMenuRestaurant(slug);

  if (!restaurantData) return notFound();

  const readOnly = p.origem === "vitrine";
  if (readOnly && restaurantData.vitrine_enabled !== true) return notFound();

  let tableOrder: QrTableMenuContext | null = null;
  if (p.origem === "mesa") {
    const [{ data: settings }, { data: legacyTokens }] = await Promise.all([
      supabase.from("restaurant_qr_settings").select("universal_token")
        .eq("restaurant_id", restaurantData.id).maybeSingle(),
      supabase.from("restaurant_addons").select("universal_token")
        .eq("restaurant_id", restaurantData.id).in("product_key", ["qr_code_mesa", "ia_plus"]),
    ]);

    const token = String(p.mesa || settings?.universal_token || "").trim();
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        token,
      );
    if (!isUuid) return notFound();

    if (settings?.universal_token === token || legacyTokens?.some((row) => token === row.universal_token)) {
      const { data: tableRows } = await supabase
        .from("restaurant_tables")
        .select("id, name")
        .eq("restaurant_id", restaurantData.id)
        .eq("is_active", true)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });

      tableOrder = {
        token,
        tableId: null,
        tableName: null,
        requiresTableSelection: true,
        tables: tableRows || [],
      };
    } else {
      const { data: table } = await supabase
        .from("restaurant_tables")
        .select("id, name")
        .eq("restaurant_id", restaurantData.id)
        .eq("public_token", token)
        .eq("is_active", true)
        .maybeSingle();
      if (!table) return notFound();

      tableOrder = {
        token,
        tableId: table.id,
        tableName: table.name,
        requiresTableSelection: false,
        tables: [{ id: table.id, name: table.name }],
      };
    }
  }

  const storeWhatsapp = getStoreWhatsapp(restaurantData.store_whatsapp);

  const restaurant: Restaurant & {
    address: any;
    force_whatsapp_order_confirmation?: boolean;
    allow_future_order_scheduling?: boolean;
    preorder_only?: boolean;
    preorder_availability_json?: any;
    preorder_min_days?: number;
  } = {
    id: restaurantData.id,
    pizza_settings: restaurantData.pizza_settings,
    automatic_promotions: restaurantData.automatic_promotions,
    name: restaurantData.name,
    logo_url: getPublicUrl(
      supabase,
      "restaurant-logos",
      restaurantData.logo_url,
    ),
    banner_url:
      getPublicUrl(supabase, "menu-banners", restaurantData.banner_url) ||
      "/placeholders/banner.webp",
    rating: restaurantData.rating,
    min_order_cents: restaurantData.min_order_cents,
    availability_json: normalizeEndOfDayAvailability(
      restaurantData.availability_json,
    ),
    delivery_fee_json: restaurantData.delivery_fee_json,
    delivery_fee_mode: restaurantData.delivery_fee_mode,
    delivery_neighborhood_fee_json: restaurantData.delivery_neighborhood_fee_json,
    small_city_mode_enabled: restaurantData.small_city_mode_enabled === true,
    latitude: restaurantData.latitude,
    longitude: restaurantData.longitude,
    is_closed: restaurantData.is_closed,
    manual_open_until: restaurantData.manual_open_until,
    allowed_payment_methods: restaurantData.allowed_payment_methods,
    address: restaurantData.address,
    pickup_enabled: restaurantData.pickup_enabled === true,
    delivery_disabled: restaurantData.delivery_disabled === true,
    force_whatsapp_order_confirmation:
      restaurantData.force_whatsapp_order_confirmation === true,
    allow_future_order_scheduling:
      restaurantData.allow_future_order_scheduling === true,
    preorder_only: restaurantData.preorder_only === true,
    preorder_availability_json: normalizeEndOfDayAvailability(restaurantData.preorder_availability_json),
    preorder_min_days: restaurantData.preorder_min_days ?? 0,
  };

  // A mandatory group with more than one available price requires a starting-price label.
  const startingPrices = query<{ id: string }>(
    `SELECT item.id
     FROM public.items AS item
     WHERE item.restaurant_id = $1 AND item.is_available IS TRUE
       AND EXISTS (
         SELECT 1
         FROM public.item_subcategories AS addon_group
         JOIN public.subitems AS option ON option.item_subcategory_id = addon_group.id
         WHERE addon_group.item_id = item.id AND addon_group.min_select > 0 AND option.is_available IS TRUE
         GROUP BY addon_group.id
         HAVING MIN(COALESCE(option.price_cents, 0)) <> MAX(COALESCE(option.price_cents, 0))
       )`,
    [restaurant.id],
  ).then(({ rows }) => rows.map(row => row.id)).catch(error => {
    console.error("Erro ao verificar preços dos complementos obrigatórios:", error);
    return [];
  });

  const catalogItems = supabase
    .from("items")
    .select(
      "id, name, description, price_cents, image_path, gallery_media, is_available, available_for_delivery, available_for_salao, availability_schedule, position, category_id, category:category_id(id, name, position)",
    )
    .eq("restaurant_id", restaurant.id)
    .order("position", { ascending: true }).then(async ({ data }) => {
    const itemsRaw = data || [];
    const hasPaidMenuFeatures = restaurantData.dark_menu_enabled === true ||
      itemsRaw.some(item => Array.isArray(item.gallery_media) && item.gallery_media.length > 0);
    const plusActive = hasPaidMenuFeatures && await hasIMenuPlusAccess(restaurant.id).catch(error => {
      console.error("[PUBLIC_MENU] Unable to check Plus access:", error);
      return false;
    });
    return { itemsRaw, plusActive };
  });

  // These reads only depend on the restaurant and do not depend on each other.
  // Running them together removes avoidable database round trips from the TTFB.
  const now = new Date().toISOString();
  const [
    loyaltyResult,
    trackingResult,
    categoriesResult,
    { itemsRaw, plusActive },
    promotionsResult,
    startingPriceItemIds,
  ] = await Promise.all([
    supabase
      .from("loyalty_programs")
      .select("active")
      .eq("restaurant_id", restaurantData.id)
      .maybeSingle(),
    supabase
      .from("tracking_integrations")
      .select("ga4_id, gtm_id, ga4_enabled, gtm_enabled, meta_pixel_id, meta_capi_token, is_enabled")
      .eq("restaurant_id", restaurantData.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("categories")
      .select("id, name, position, availability_schedule")
      .eq("restaurant_id", restaurant.id)
      .order("position", { ascending: true }),
    catalogItems,
    supabase
      .from("promotions")
      .select("id,item_id , type, value, starts_at, ends_at")
      .eq("restaurant_id", restaurant.id)
      .lte("starts_at", now)
      .or(`ends_at.gte.${now},ends_at.is.null`),
    startingPrices,
  ]);

  const loyaltyProgram = loyaltyResult.data;
  const tracking = trackingResult.data;
  const metaPixelId = tracking?.is_enabled ? cleanMetaPixelId(tracking.meta_pixel_id) : null;
  const categories: Category[] = categoriesResult.data || [];
  const promotions = promotionsResult.data;
  const loyaltyProgramActive =
    !tableOrder && loyaltyProgram?.active === true;

  const darkMenuActive = restaurantData.dark_menu_enabled === true && plusActive === true;
  let allItems: Item[] = itemsRaw
    .filter((item: any) => item.is_available === true && (readOnly || isItemAvailableForChannel(item, tableOrder ? "mesa" : "entrega")))
    .map((item: any) => ({
      ...item,
      image_public_url: getMenuItemImageUrl(supabase, item.image_path),
      gallery_media: plusActive ? getPublicItemMedia(supabase, item.gallery_media) : [],
    }));

  // ======================
  // ADD PROMOTIONS TO ITEMS
  // ======================

  const promotionByItemId = new Map<string, any>();

  (promotions || []).forEach((promo) => {
    if (promo.item_id) {
      promotionByItemId.set(promo.item_id, promo);
    }
  });

  allItems = allItems.map((item) => ({
    ...item,
    promotion: promotionByItemId.get(item.id) ?? undefined,
  }));

  // --- 5. Group Items by Category ---

  const itemsByCategory: ItemsByCategory = {};
  for (const cat of categories) itemsByCategory[cat.id] = [];
  const uncategorized = "_uncategorized";
  itemsByCategory[uncategorized] = [];

  allItems.forEach((it) => {
    const cid = it?.category?.id;
    if (cid && itemsByCategory[cid]) itemsByCategory[cid].push(it);
    else itemsByCategory[uncategorized].push(it);
  });

  const categoriesWithItems = categories.filter(
    (c) => (itemsByCategory[c.id]?.length ?? 0) > 0,
  );

  return (
    <div data-imenu-menu-theme={darkMenuActive ? "dark" : undefined} className={darkMenuActive ? "imenu-menu-theme-dark" : undefined}>
      {tracking && (
        <TrackingScripts
          ga4Id={tracking?.ga4_id}
          gtmId={tracking?.gtm_id}
          ga4Enabled={tracking.ga4_enabled}
          gtmEnabled={tracking.gtm_enabled}
          metaPixelId={metaPixelId}
        />
      )}

      <PickupAvailabilityGuard
        enabled={!readOnly && !tableOrder && restaurant.pickup_enabled === true}
      />

      <div
        data-loyalty-history-enabled={
          loyaltyProgramActive ? "true" : "false"
        }
      >
        {!loyaltyProgramActive && (
          <style>{`
            [data-loyalty-history-enabled="false"]
            div.top-7.right-5.fixed.flex.gap-4
            > div:first-child {
              display: none !important;
            }
          `}</style>
        )}

        <StartingPriceLabels items={startingPriceItemIds}>
        <MenuClientPage
          slug={slug}
          metaPixelId={metaPixelId}
          metaCapiEnabled={Boolean(metaPixelId && tracking?.meta_capi_token?.trim())}
          readOnly={readOnly}
          darkTheme={darkMenuActive}
          restaurant={restaurant}
          categories={categoriesWithItems}
          itemsByCategory={itemsByCategory}
          initialMenuTime={now}
          openedProductId={p.p}
          selectedCouponCode={readOnly || tableOrder ? undefined : p.c?.toUpperCase()}
          tableOrder={tableOrder}
        />
        </StartingPriceLabels>
      </div>

      <footer className="w-full bg-[var(--im-menu-surface,#fff)] px-6 pb-32 pt-8 text-center md:pb-40">
        <div className="mx-auto flex max-w-md flex-col items-center">
          {storeWhatsapp && (
            <a
              href={storeWhatsapp.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir WhatsApp da loja no número ${storeWhatsapp.formatted}`}
              className="inline-flex items-center gap-3 rounded-full border border-[var(--im-menu-border,#e5e7eb)] bg-[var(--im-menu-soft,#f9fafb)] py-1.5 pl-4 pr-1.5 text-sm font-medium text-[var(--im-menu-text-soft,#374151)] transition hover:border-[var(--im-menu-success-border,#bbf7d0)] hover:bg-[var(--im-menu-success-bg,#f0fdf4)] hover:text-[var(--im-menu-success-text,#15803d)]"
            >
              <FontAwesomeIcon
                icon={faWhatsapp}
                className="text-lg text-[var(--im-menu-success-text,#16a34a)]"
              />
              <span>{storeWhatsapp.formatted}</span>
              {restaurant.logo_url && (
                <Image
                  src={restaurant.logo_url}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full border border-[var(--im-menu-border,#e5e7eb)] bg-[var(--im-menu-surface,#fff)] object-cover"
                />
              )}
            </a>
          )}

          <a
            href="/"
            aria-label="Conhecer o iMenu"
            className="mt-8 inline-flex flex-col items-center gap-1 text-xs text-[var(--im-menu-subtle,#9ca3af)] transition hover:opacity-70"
          >
            <span className="inline-flex items-center gap-2">
              <span>Criado com</span>
              <img
                src={darkMenuActive ? "/logos/CombinationMarkLogo_White.png" : "/logos/CombinationMarkLogo_Black.png"}
                alt="iMenu"
                className="h-5 w-auto opacity-35"
              />
            </span>
            <span>Crie o seu gratuitamente</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

