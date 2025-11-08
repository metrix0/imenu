// app/menu/[id]/page.tsx
import { createClient } from "@supabase/supabase-js";
import MenuAdminClient from "./menu-admin-client";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function MenuPage({ params }: Props) {
  const { id: menuId } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // buscar menu (inclui restaurant_id, banner_url e description)
  const { data: menu, error: menuError } = await supabase
    .from("menu")
    .select("id, name, restaurant_id, banner_url, description")
    .eq("id", menuId)
    .maybeSingle();

  if (menuError) {
    console.error(menuError);
    return <div>Erro ao buscar menu</div>;
  }
  if (!menu) {
    return <div>Menu não encontrado</div>;
  }

  // buscar dados do restaurante (owner + logo)
  const { data: restaurantData, error: restErr } = await supabase
    .from("restaurants")
    .select("id, user_id, logo_url")
    .eq("id", menu.restaurant_id)
    .maybeSingle();

  if (restErr) {
    console.error("Erro ao buscar restaurante:", restErr);
  }

  const restaurantOwnerId = restaurantData?.user_id ?? null;
  const restaurantLogoKey = restaurantData?.logo_url ?? null;

  // gerar URLs públicas (se houver)
  const menuBannerPublicUrl = menu.banner_url
    ? supabase.storage.from("menu-banners").getPublicUrl(menu.banner_url).data?.publicUrl
    : null;

  const restaurantLogoPublicUrl = restaurantLogoKey
    ? supabase.storage.from("restaurant-logos").getPublicUrl(restaurantLogoKey).data?.publicUrl
    : null;

  // buscar categorias deste restaurante
  const { data: categoriesRaw, error: catErr } = await supabase
    .from("categories")
    .select("id, name, position")
    .eq("restaurant_id", menu.restaurant_id)
    .order("position", { ascending: true });

  if (catErr) {
    console.error("Erro ao buscar categorias:", catErr);
    // continua com array vazio
  }
  const categories = categoriesRaw ?? [];

  // buscar item_ids do menu
  const { data: miRows, error: miErr } = await supabase
    .from("menu_items")
    .select("item_id")
    .eq("menu_id", menuId);

  if (miErr) {
    console.error(miErr);
    return <div>Erro ao buscar itens do menu</div>;
  }

  const itemIds = (miRows || []).map((r: any) => r.item_id);
  if (itemIds.length === 0) {
    return (
      <MenuAdminClient
        menuId={menuId}
        menuName={menu.name}
        items={[]}
        categories={categories}
        restaurantId={menu.restaurant_id}
        restaurantOwnerId={restaurantOwnerId}
        restaurantLogoUrl={restaurantLogoPublicUrl}
        initialBannerUrl={menuBannerPublicUrl}
        initialDescription={menu.description ?? null}
      />
    );
  }

  // buscar detalhes dos itens (categoria possivelmente vem como array)
  const { data: itemsRaw, error: itemsErr } = await supabase
    .from("items")
    .select(
      `
      id,
      name,
      description,
      price_cents,
      image_path,
      is_available,
      position,
      category:categories(id, name)
    `
    )
    .in("id", itemIds)
    .order("position", { ascending: true });

  if (itemsErr) {
    console.error(itemsErr);
    return <div>Erro ao buscar detalhes dos itens</div>;
  }

  // Normalizar category: se vier um array, pegar o primeiro elemento (ou null)
  const normalizedItems = (itemsRaw || []).map((it: any) => {
    const cat = it.category;
    const normalizedCategory = Array.isArray(cat) ? (cat.length > 0 ? cat[0] : null) : cat ?? null;

    return {
      id: it.id,
      name: it.name,
      description: it.description,
      price_cents: it.price_cents,
      image_path: it.image_path,
      is_available: it.is_available,
      position: it.position,
      category: normalizedCategory,
    };
  });

  return (
    <MenuAdminClient
      menuId={menuId}
      menuName={menu.name}
      items={normalizedItems}
      categories={categories}
      restaurantId={menu.restaurant_id}
      restaurantOwnerId={restaurantOwnerId}
      restaurantLogoUrl={restaurantLogoPublicUrl}
      initialBannerUrl={menuBannerPublicUrl}
      initialDescription={menu.description ?? null}
    />
  );
}
