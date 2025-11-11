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
        name: "name",
        latitude: "latitude",
        longitude: "longitude",
        avg_delivery_minutes: "avg_delivery_minutes",
        delivery_fee_json: "delivery_fee_json",
        // ADD OTHER FIELDS FROM SIGN IN FLOW...
        // "availability_json": "availability_json", 
        // "address": "address",
    };

    const fieldsToUpdate = []; // E.g.: ["name = $2", "latitude = $3"]
    const values = [id]; // $1 will always be the ID

    // dinamic query
    for (const key in body) {
        if (Object.prototype.hasOwnProperty.call(body, key) && allowedFields[key]) {
            values.push(body[key]); // add value
            // add string (ex: "name = $2")
            fieldsToUpdate.push(`${allowedFields[key]} = $${values.length}`);
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
            UPDATE public.restaurantes
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

// TODO: ALSO ADD GET FUNCTION IN THIS FILE
// TO QUERY RESTAURANT DATA