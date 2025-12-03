// app/api/restaurants/[id]/route.ts
import { query } from "@/lib/sql";
import { NextResponse } from "next/server";


export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;

    // TODO: ADD AUTH
    // LOGGED ON USER CAN EDIT THIS RESTAURANT?
    

    if (!id) {
        return NextResponse.json({ error: "Restaurant ID is required" }, { status: 400 });
    }

    let body;
    try {
        body = await request.json();
    } catch (e) {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // --- DINAMIC UPDATE ---


    const allowedFields: { [key: string]: string } = {
        email: "email",
        latitude: "latitude",
        longitude: "longitude",
        address: "address", 
        delivery_fee_json: "delivery_fee_json",
        availability_json: "availability_json",
        name: "name",   
        phone: "owner_phone", 
        user_id: "user_id",
        logo_url: "logo_url",
        description: "description"           
        
    };

    const fieldsToUpdate = []; // E.g.: ["name = $2", "latitude = $3"]
    const values = [id]; // $1 will always be the ID

    // dinamic query
    for (const key in body) {
        const dbColumn = key === 'address_full' ? 'address' : allowedFields[key];
        if (Object.prototype.hasOwnProperty.call(body, key) && dbColumn) {
            let value = body[key];
            if (dbColumn.includes("_json")) {
                value = JSON.stringify(value);
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
    // --- end of dinamic update ---

    try {
        const updateQuery = `
            UPDATE public.restaurants
            SET 
                ${fieldsToUpdate.join(", ")} 
            WHERE 
                id = $1
            RETURNING id;
        `;

        const { rows } = await query(updateQuery, values);

        if (rows.length === 0) {
            return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, updatedId: rows[0].id });

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
            SELECT id, name, phone
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
