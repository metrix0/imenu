import { query } from "@/lib/database/sql";
import { NextResponse } from "next/server";

function normalizeSlug(value: string): string {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

function normalizeStoredPhone(value: unknown): string | null {
    const digits = String(value ?? "").replace(/\D/g, "").slice(0, 13);
    return digits || null;
}

function normalizePublicWhatsApp(value: unknown): string {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("55") && digits.length >= 12) return digits;
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
}

function getPublicRestaurantLogoUrl(value: unknown): string {
    const logoPath = String(value ?? "").trim();
    if (!logoPath) return "";
    if (/^https?:\/\//i.test(logoPath)) return logoPath;

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
    if (!supabaseUrl) return logoPath;

    const encodedPath = logoPath
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");

    return `${supabaseUrl}/storage/v1/object/public/restaurant-logos/${encodedPath}`;
}

async function slugExists(slug: string, restaurantId: string): Promise<boolean> {
    const { rows } = await query(
        `
        SELECT 1
        FROM public.restaurants
        WHERE url_slug = $1
          AND id <> $2
        LIMIT 1
        `,
        [slug, restaurantId]
    );
    return rows.length > 0;
}

async function generateUniqueSlug(
    source: string,
    restaurantId: string
): Promise<string> {
    const base = normalizeSlug(source) || "restaurante";
    if (!(await slugExists(base, restaurantId))) return base;

    for (let attempt = 0; attempt < 40; attempt += 1) {
        const suffix = Math.floor(1000 + Math.random() * 9000);
        const candidate = `${base}-${suffix}`;
        if (!(await slugExists(candidate, restaurantId))) return candidate;
    }

    const fallback = `${base}-${Date.now().toString().slice(-7)}`;
    if (!(await slugExists(fallback, restaurantId))) return fallback;
    throw new Error("Não foi possível gerar um endereço único para a loja.");
}

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;

    if (!id) {
        return NextResponse.json(
            { error: "Restaurant ID is required" },
            { status: 400 }
        );
    }

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
        const currentResult = await query(
            `SELECT id, url_slug FROM public.restaurants WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (currentResult.rows.length === 0) {
            return NextResponse.json(
                { error: "Restaurant not found" },
                { status: 404 }
            );
        }

        const currentRestaurant = currentResult.rows[0];
        const hasExplicitSlug = Object.prototype.hasOwnProperty.call(
            body,
            "url_slug"
        );

        if (hasExplicitSlug) {
            const requestedSlug = normalizeSlug(String(body.url_slug ?? ""));
            if (requestedSlug.length < 3) {
                return NextResponse.json(
                    {
                        error:
                            "O endereço da loja precisa ter pelo menos 3 caracteres.",
                    },
                    { status: 400 }
                );
            }
            if (await slugExists(requestedSlug, id)) {
                return NextResponse.json(
                    {
                        error:
                            "Este endereço já está sendo usado por outro restaurante.",
                    },
                    { status: 409 }
                );
            }
            body.url_slug = requestedSlug;
        } else if (
            body.name &&
            !String(currentRestaurant.url_slug ?? "").trim()
        ) {
            body.url_slug = await generateUniqueSlug(String(body.name), id);
        }

        const allowedFields: Record<string, string> = {
            latitude: "latitude",
            longitude: "longitude",
            address: "address",
            delivery_fee_json: "delivery_fee_json",
            availability_json: "availability_json",
            name: "name",
            phone: "phone",
            store_whatsapp: "store_whatsapp",
            user_id: "user_id",
            logo_url: "logo_url",
            banner_url: "banner_url",
            description: "description",
            min_order_cents: "min_order_cents",
            rating: "rating",
            url_slug: "url_slug",
            is_closed: "is_closed",
            first_time: "first_time",
            creation_step: "creation_step",
            payment_method: "payment_method",
            payment_info: "payment_info",
            payment_info_type: "payment_info_type",
            allowed_payment_methods: "allowed_payment_methods",
            pickup_enabled: "pickup_enabled",
            prep_time_min_minutes: "prep_time_min_minutes",
            prep_time_max_minutes: "prep_time_max_minutes",
            prep_time_source: "prep_time_source",
        };

        const jsonFields = [
            "address",
            "delivery_fee_json",
            "availability_json",
        ];
        const arrayFields = ["allowed_payment_methods"];
        const fieldsToUpdate: string[] = [];
        const values: unknown[] = [id];

        for (const key of Object.keys(body)) {
            const dbColumn = allowedFields[key];
            if (!dbColumn) continue;

            let value = body[key];

            if (jsonFields.includes(dbColumn) || dbColumn.includes("_json")) {
                value = JSON.stringify(value);
            }

            if (arrayFields.includes(dbColumn)) {
                value =
                    Array.isArray(value) && value.length > 0
                        ? value
                        : ["pix", "dinheiro", "trazer-maquininha"];
            }

            if (dbColumn === "store_whatsapp" || dbColumn === "phone") {
                value = normalizeStoredPhone(value);
            }

            if (dbColumn === "creation_step") {
                const step = Number(value);
                if (![1, 2, 3, 4].includes(step)) continue;
                value = step;
            }

            values.push(value);
            fieldsToUpdate.push(`${dbColumn} = $${values.length}`);
        }

        if (fieldsToUpdate.length === 0) {
            return NextResponse.json(
                { error: "No valid fields provided to update" },
                { status: 400 }
            );
        }

        const { rows } = await query(
            `
            UPDATE public.restaurants
            SET ${fieldsToUpdate.join(", ")}, updated_at = NOW()
            WHERE id = $1
            RETURNING id, url_slug, store_whatsapp, creation_step, first_time
            `,
            values
        );

        return NextResponse.json({
            success: true,
            updatedId: rows[0].id,
            url_slug: rows[0].url_slug,
            store_whatsapp: rows[0].store_whatsapp,
            creation_step: rows[0].creation_step,
            first_time: rows[0].first_time,
        });
    } catch (error) {
        console.error("Error updating restaurant:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Internal server error",
            },
            { status: 500 }
        );
    }
}

export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;

    if (!id) {
        return NextResponse.json(
            { error: "Restaurant ID is required" },
            { status: 400 }
        );
    }

    try {
        const { rows } = await query(
            `
            SELECT
                id,
                name,
                phone,
                store_whatsapp,
                logo_url,
                address,
                latitude,
                longitude,
                url_slug,
                payment_method,
                payment_info,
                payment_info_type,
                allowed_payment_methods,
                pickup_enabled,
                creation_step,
                first_time,
                prep_time_min_minutes,
                prep_time_max_minutes,
                prep_time_source
            FROM public.restaurants
            WHERE id = $1
            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { error: "Restaurant not found" },
                { status: 404 }
            );
        }

        const restaurant = rows[0];
        return NextResponse.json({
            ...restaurant,
            phone: normalizePublicWhatsApp(
                restaurant.store_whatsapp || restaurant.phone
            ),
            logo_url: getPublicRestaurantLogoUrl(restaurant.logo_url),
        });
    } catch (error) {
        console.error("Error fetching restaurant:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
