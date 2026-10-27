import { NextResponse } from "next/server";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { buildPrintableMenuPdf, type PrintableMenuCategory } from "@/lib/menu/printPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MenuCategoryRow = { id: string; name: string };
type MenuItemRow = {
    category_id: string;
    name: string;
    description: string | null;
    price_cents: number;
};

export async function GET(request: Request) {
    const restaurantId = new URL(request.url).searchParams.get("restaurantId");
    if (!restaurantId || !UUID.test(restaurantId)) {
        return NextResponse.json({ error: "Restaurante inválido." }, { status: 400 });
    }

    try {
        const { restaurant } = await requireRestaurantOwner(request, restaurantId);
        if (!(await hasIMenuPlusAccess(restaurantId))) {
            return NextResponse.json(
                { error: "Exportar o cardápio em PDF é uma função do iMenu Plus." },
                { status: 403, headers: { "Cache-Control": "no-store" } },
            );
        }

        const [categoryResult, itemResult] = await Promise.all([
            query<MenuCategoryRow>(
                "SELECT id, name FROM categories WHERE restaurant_id = $1 ORDER BY position ASC, name ASC",
                [restaurantId],
            ),
            query<MenuItemRow>(
                `SELECT category_id, name, description, price_cents
                 FROM items
                 WHERE restaurant_id = $1 AND is_available = true
                   AND (stock_enabled IS NOT TRUE OR stock_quantity IS NULL OR stock_quantity > 0)
                 ORDER BY position ASC, name ASC`,
                [restaurantId],
            ),
        ]);

        const grouped = new Map<string, PrintableMenuCategory>();
        for (const category of categoryResult.rows) {
            grouped.set(category.id, { name: category.name, items: [] });
        }
        for (const item of itemResult.rows) {
            const category = grouped.get(item.category_id);
            if (category) {
                category.items.push({
                    name: item.name,
                    description: item.description,
                    price_cents: item.price_cents,
                });
            }
        }

        const pdf = buildPrintableMenuPdf({
            restaurantName: restaurant.name || "Restaurante",
            categories: [...grouped.values()],
        });
        const filename = (restaurant.url_slug || "cardapio").replace(/[^a-zA-Z0-9_-]/g, "-");
        return new Response(new Uint8Array(pdf), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="cardapio-${filename}.pdf"`,
                "Cache-Control": "private, no-store",
            },
        });
    } catch (error) {
        const status = error instanceof RestaurantOwnerAuthError ? error.status : 500;
        if (status === 500) console.error("[MENU_PRINT_PDF]", error);
        return NextResponse.json(
            { error: status === 500 ? "Não foi possível gerar o PDF do cardápio." : (error as Error).message },
            { status, headers: { "Cache-Control": "no-store" } },
        );
    }
}
