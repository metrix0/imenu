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
  params: { slug: string };
  searchParams: { p?: string; c?: string };
}) {
  const { slug } = await params;
  const p = await searchParams;

  const supabase = createSupabaseServerClient();

  // --- 1. Restaurante ---
  const { data: restaurantData } = await supabase
    .from("restaurants")
    .select(
      "id, name, is_closed, logo_url, rating, min_order_cents, description, banner_url, availability_json,delivery_fee_json, latitude, longitude, allowed_payment_methods, address, store_whatsapp, pickup_enabled",
    )
    .eq("url_slug", slug)
    .maybeSingle();

  if (!restaurantData) return notFound();

  const storeWhatsapp = getStoreWhatsapp(restaurantData.store_whatsapp);

  const restaurant: Restaurant & { address: any } = {
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
  };

  // The banner is the page LCP element. Start its request as soon as the
  // restaurant row resolves instead of waiting for the remaining menu data.
  if (restaurant.banner_url) {
    preload(restaurant.banner_url, { as: "image", fetchPriority: "high" });
  }

  // These reads only depend on the restaurant and do not depend on each other.
  // Running them together removes avoidable database round trips from the TTFB.
  const now = new Date().toISOString();
  const [
    loyaltyResult,
    trackingResult,
    categoriesResult,
    itemsResult,
    promotionsResult,
  ] = await Promise.all([
    supabase
      .from("loyalty_programs")
      .select("active")
      .eq("restaurant_id", restaurantData.id)
      .maybeSingle(),
    supabase
      .from("tracking_integrations")
      .select("ga4_id, gtm_id, meta_pixel_id")
      .eq("restaurant_id", restaurantData.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("categories")
      .select("id, name, position")
      .eq("restaurant_id", restaurant.id)
      .order("position", { ascending: true }),
    supabase
      .from("items")
      .select(
        "id, name, description, price_cents, image_path, is_available, position, category:category_id(id, name, position)",
      )
      .eq("restaurant_id", restaurant.id)
      .order("position", { ascending: true }),
    supabase
      .from("promotions")
      .select("id,item_id , type, value, starts_at, ends_at")
      .eq("restaurant_id", restaurant.id)
      .lte("starts_at", now)
      .or(`ends_at.gte.${now},ends_at.is.null`),
  ]);

  const loyaltyProgram = loyaltyResult.data;
  const tracking = trackingResult.data;
  const categories: Category[] = categoriesResult.data || [];
  const itemsRaw = itemsResult.data || [];
  const promotions = promotionsResult.data;
  const loyaltyProgramActive = loyaltyProgram?.active === true;
  const itemIds = itemsRaw.map((item: any) => item.id);

  // Show "A partir de" only when a product has at least one mandatory
  // complemento group where every available option costs more than R$ 0.
  // A mandatory group with any available free option must NOT trigger it.
  const itemIdsWithMandatoryPaidGroup = new Set<string>();

  if (itemIds.length > 0) {
    const { data: mandatoryGroups, error: mandatoryGroupsError } =
      await supabase
        .from("item_subcategories")
        .select("id, item_id")
        .in("item_id", itemIds)
        .gt("min_select", 0);

    if (mandatoryGroupsError) {
      console.error(
        "Erro ao verificar complementos obrigatórios:",
        mandatoryGroupsError,
      );
    } else {
      const groups = mandatoryGroups || [];
      const groupIds = groups.map((group: any) => group.id);

      if (groupIds.length > 0) {
        const { data: availableSubitems, error: availableSubitemsError } =
          await supabase
            .from("subitems")
            .select("item_subcategory_id, price_cents")
            .in("item_subcategory_id", groupIds)
            .eq("is_available", true);

        if (availableSubitemsError) {
          console.error(
            "Erro ao verificar opções dos complementos obrigatórios:",
            availableSubitemsError,
          );
        } else {
          const pricesByGroupId = new Map<string, number[]>();

          (availableSubitems || []).forEach((subitem: any) => {
            const prices =
              pricesByGroupId.get(subitem.item_subcategory_id) || [];
            prices.push(Number(subitem.price_cents) || 0);
            pricesByGroupId.set(subitem.item_subcategory_id, prices);
          });

          groups.forEach((group: any) => {
            const prices = pricesByGroupId.get(group.id) || [];

            // Empty groups do not trigger the label. A group triggers only
            // when it has selectable options and none of them is free.
            const hasOptions = prices.length > 0;
            const hasFreeOption = prices.some((price) => price <= 0);

            if (hasOptions && !hasFreeOption) {
              itemIdsWithMandatoryPaidGroup.add(group.item_id);
            }
          });
        }
      }
    }
  }

  let allItems: Item[] = itemsRaw
    .filter((item: any) => item.is_available === true)
    .map((item: any) => ({
      ...item,
      image_public_url: getPublicUrl(supabase, "menu-images", item.image_path),
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

  const startingPriceItemIds = itemIdsWithMandatoryPaidGroup;

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
    <>
      {tracking && (
        <TrackingScripts
          ga4Id={tracking?.ga4_id}
          gtmId={tracking?.gtm_id}
          metaPixelId={tracking?.meta_pixel_id}
        />
      )}

      <PickupAvailabilityGuard
        enabled={restaurant.pickup_enabled === true}
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

        <MenuClientPage
          slug={slug}
          restaurant={restaurant}
          categories={categoriesWithItems}
          itemsByCategory={itemsByCategory}
          openedProductId={p.p}
          selectedCouponCode={p.c?.toUpperCase()}
        />
      </div>

      <StartingPriceLabels
        items={allItems
          .filter((item) => startingPriceItemIds.has(item.id))
          .map((item) => ({
            id: item.id,
            name: item.name,
            imageUrl: item.image_public_url,
          }))}
      />

      <footer className="w-full bg-white px-6 pb-32 pt-8 text-center md:pb-40">
        <div className="mx-auto flex max-w-md flex-col items-center">
          {storeWhatsapp && (
            <a
              href={storeWhatsapp.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir WhatsApp da loja no número ${storeWhatsapp.formatted}`}
              className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-gray-50 py-1.5 pl-4 pr-1.5 text-sm font-medium text-gray-700 transition hover:border-green-200 hover:bg-green-50 hover:text-green-700"
            >
              <FontAwesomeIcon
                icon={faWhatsapp}
                className="text-lg text-green-600"
              />
              <span>{storeWhatsapp.formatted}</span>
              {restaurant.logo_url && (
                <img
                  src={restaurant.logo_url}
                  alt=""
                  className="h-10 w-10 rounded-full border border-gray-200 bg-white object-cover"
                />
              )}
            </a>
          )}

          <a
            href="/"
            aria-label="Conhecer o iMenu"
            className="mt-8 inline-flex items-center gap-2 text-xs text-gray-400 transition hover:opacity-70"
          >
            <span>Criado com</span>
            <img
              src="/logos/CombinationMarkLogo_Black.png"
              alt="iMenu"
              className="h-5 w-auto opacity-35"
            />
          </a>
        </div>
      </footer>
    </>
  );
}
