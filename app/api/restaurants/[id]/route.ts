import { query } from "@/lib/database/sql";
import { NextResponse } from "next/server";

// Helper simples para gerar slug
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-z0-9]+/g, "-") // Substitui chars especiais por hífen
        .replace(/^-+|-+$/g, "") // Remove hífens do começo/fim
        + "-" + Math.floor(Math.random() * 1000); // Adiciona sufixo random para evitar colisão simples
}

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;

    if (!id) {
        return NextResponse.json({ error: "Restaurant ID is required" }, { status: 400 });
    }

    let body;
    try {
        body = await request.json();
    } catch (e) {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // --- DYNAMIC UPDATE CONFIG ---

    const allowedFields: { [key: string]: string } = {
        latitude: "latitude",
        longitude: "longitude",
        address: "address", 
        delivery_fee_json: "delivery_fee_json",
        availability_json: "availability_json",
        name: "name",   
        phone: "phone",
        user_id: "user_id",
        logo_url: "logo_url",
        banner_url: "banner_url",
        description: "description",
        min_order_cents: "min_order_cents",
        rating: "rating",
        url_slug: "url_slug", // Permitir atualização explícita se necessário
        is_closed: "is_closed",
        first_time: "first_time",
        payment_method: "payment_method",
        payment_info: "payment_info",
        allowed_payment_methods: "allowed_payment_methods",
    };

    const jsonFields = ["address", "delivery_fee_json", "availability_json"];
    const arrayFields = ["allowed_payment_methods"];

    const fieldsToUpdate = [];
    const values = [id]; // $1 será sempre o ID

    // Lógica de Slug Automático
    // Se o usuário mandou 'name', mas não mandou 'url_slug', geramos um.
    if (body.name && !body.url_slug) {
        body.url_slug = generateSlug(body.name);
    }

    // --- BUILD QUERY ---
    for (const key in body) {
        if (Object.prototype.hasOwnProperty.call(body, key) && allowedFields[key]) {
            const dbColumn = allowedFields[key];
            let value = body[key];

            if (jsonFields.includes(dbColumn) || dbColumn.includes("_json")) {
                value = JSON.stringify(value);
            }

            if (arrayFields.includes(dbColumn)) {
                value = Array.isArray(value) && value.length > 0
                    ? value
                    : ["pix", "dinheiro", "trazer-maquininha"];
            }

            values.push(value);
            fieldsToUpdate.push(`${dbColumn} = $${values.length}`);
        }
    }

    if (fieldsToUpdate.length === 0) {
        return NextResponse.json(
            { error: "No valid fields provided to update" },
            { status: 400 }
        );
    }

    try {
        const updateQuery = `
            UPDATE public.restaurants
            SET 
                ${fieldsToUpdate.join(", ")},
                updated_at = NOW()
            WHERE 
                id = $1
            RETURNING id, url_slug; 
        `;

        const { rows } = await query(updateQuery, values);

        if (!rows || rows.length === 0) {
            return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
        }

        // Retorna o slug atualizado para o frontend saber
        return NextResponse.json({ 
            success: true, 
            updatedId: rows[0].id,
            url_slug: rows[0].url_slug 
        });

    } catch (error) {
        console.error("Error updating restaurant:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function GET(
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

    try {
        const { rows } = await query(
            `
            SELECT id, name, phone, address, latitude, longitude, url_slug, allowed_payment_methods
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

        return NextResponse.json(rows[0]);
    } catch (error) {
        console.error("Error fetching restaurant:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}