// app/[slug]/page.tsx

import { notFound } from "next/navigation";
import { preload } from "react-dom";
import MenuClientPage from "./menu-client";
import StartingPriceLabels from "./StartingPriceLabels";
import {
  Category,
  Item,
  ItemsByCategory,
  Restaurant,
} from "@/lib/types/types";
import TrackingScripts from "@/components/costumer/TrackingScripts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import PickupAvailabilityGuard from "./PickupAvailabilityGuard";

import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import type {
  QrTableAddon,
  QrTableMenuContext,
} from "@/lib/qr-table/types";
import { hasQrTableAccess } from "@/lib/qr-table/types";

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
  const { data: restaurantData } = await supabase
    .from("restaurants")
    .select(
      "id, name, is_closed, logo_url, rating, min_order_cents, description, banner_url, availability_json,delivery_fee_json, latitude, longitude, allowed_payment_methods, address, store_whatsapp, pickup_enabled, force_whatsapp_order_confirmation, allow_future_order_scheduling",
    )
    .eq("url_slug", slug)
    .maybeSingle();

  if (!restaurantData) return notFound();

  let tableOrder: QrTableMenuContext | null = null;
  if (p.origem === "mesa") {
    const { data: addonData } = await supabase
      .from("restaurant_addons")
      .select("status, current_period_ends_at, universal_token")
      .eq("restaurant_id", restaurantData.id)
      .eq("product_key", "qr_code_mesa")
      .maybeSingle();

    const addon = (addonData as Pick<
      QrTableAddon,
      "status" | "current_period_ends_at" | "universal_token"
    > | null) || null;
    if (!addon || !hasQrTableAccess(addon)) return notFound();

    const token = String(p.mesa || addon.universal_token || "").trim();
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        token,
      );
    if (!isUuid) return notFound();

    if (token === addon.universal_token) {
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
  } = {
    id: restaurantData.id,
    name: restaurantData.name,
    logo_url: getPublicUrl(
      supabase,
      "restaurant-logos",
      restaurantData.logo_url,
    ),
    banner_url:
      getPublicUrl(supabase, "menu-banners", restaurantData.banner_url) ||
      "/placeholders/banner.png",
    rating: restaurantData.rating,
    min_order_cents: restaurantData.min_order_cents,
    availability_json: normalizeEndOfDayAvailability(
      restaurantData.availability_json,
    ),
    delivery_fee_json: restaurantData.delivery_fee_json,
    latitude: restaurantData.latitude,
    longitude: restaurantData.longitude,
    is_closed: restaurantData.is_closed,
    allowed_payment_methods: restaurantData.allowed_payment_methods,
    address: restaurantData.address,
    pickup_enabled: restaurantData.pickup_enabled === true,
    force_whatsapp_order_confirmation:
      restaurantData.force_whatsapp_order_confirmation === true,
    allow_future_order_scheduling:
      restaurantData.allow_future_order_scheduling === true,
  };

  // The banner is the page LCP element. Start its request as soon as the
  // restaurant row resolves instead of waiting for the remaining menu data.
  if (restaurant.banner_url) {
    preload(restaurant.banner_url, { as: "image", fetchPriority: "high" });
  }

  const { data: menu } = await supabase
    .from("menus")
    .select("id")
    .eq("restaurant_id", restaurantData.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!menu) return notFound();

  const [categoriesResult, itemsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, position")
      .eq("menu_id", menu.id)
      .order("position", { ascending: true }),
    supabase
      .from("items")
      .select("*")
      .eq("menu_id", menu.id)
      .eq("is_available", true)
      .order("position", { ascending: true }),
  ]);

  const categories = (categoriesResult.data || []) as Category[];
  const itemRows = itemsResult.data || [];

  const itemIds = itemRows.map((item) => item.id);
  const { data: activePromotions } = itemIds.length
    ? await supabase
        .from("promotions")
        .select("*")
        .in("item_id", itemIds)
        .eq("active", true)
    : { data: [] as any[] };

  const promotionsByItem = new Map(
    (activePromotions || []).map((promotion) => [promotion.item_id, promotion]),
  );

  const items: Item[] = itemRows.map((item) => ({
    ...item,
    image_public_url: getPublicUrl(supabase, "menu-images", item.image_path),
    promotion: promotionsByItem.get(item.id) || undefined,
  }));

  const itemsByCategory: ItemsByCategory = {};
  for (const category of categories) {
    itemsByCategory[category.id] = [];
  }
  for (const item of items) {
    if (item.category_id && itemsByCategory[item.category_id]) {
      itemsByCategory[item.category_id].push(item);
    }
  }

  return (
    <>
      <TrackingScripts restaurantId={restaurant.id} />
      <PickupAvailabilityGuard
        restaurantId={restaurant.id}
        pickupEnabled={restaurant.pickup_enabled === true}
      />
      <MenuClientPage
        restaurant={restaurant}
        categories={categories}
        itemsByCategory={itemsByCategory}
        tableOrder={tableOrder}
      />
      <StartingPriceLabels />
      {storeWhatsapp && (
        <a
          href={storeWhatsapp.href}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-xl text-white shadow-lg transition hover:scale-105 md:bottom-7 md:right-7"
          aria-label={`Falar com o restaurante pelo WhatsApp ${storeWhatsapp.formatted}`}
        >
          <FontAwesomeIcon icon={faWhatsapp} />
        </a>
      )}
    </>
  );
}
