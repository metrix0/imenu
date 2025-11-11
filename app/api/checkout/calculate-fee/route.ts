// app/api/checkout/calculate-fee/route.ts
import { query } from "@/lib/sql";
import { NextResponse } from "next/server";

// json structure
type RadiusRule = {
    radius_km: number;
    time_minutes: number;
    fee_cents: number;
};


function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // EARTH RADIUS
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // DISTANCE IN KM
}


async function getCoordsFromCep(cep: string): Promise<{ lat: number; lon: number } | null> {
    try {
        const cleanCep = cep.replace(/\D/g, "");
        const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
        if (!response.ok) return null;
        const data = await response.json();
        if (data.location && data.location.coordinates) {
            return {
                lat: data.location.coordinates.latitude,
                lon: data.location.coordinates.longitude,
            };
        }
        return null;
    } catch (error) {
        return null;
    }
}

export async function POST(request: Request) {
    try {
        const { restaurantId, cep, subtotalCents } = await request.json();

        if (!restaurantId || !cep) {
            return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
        }

        // 1. SEARCH RESTAURANT DATA

        const { rows: restaurantRows } = await query(
            `
            SELECT latitude, longitude, delivery_fee_json
            FROM public.restaurants
            WHERE id = $1
            `,
            [restaurantId]
        );

        if (restaurantRows.length === 0) {
            return NextResponse.json({ error: "Restaurante não encontrado" }, { status: 404 });
        }
        const restaurant = restaurantRows[0];
        if (!restaurant.latitude || !restaurant.longitude) {
            return NextResponse.json({ error: "Restaurante não possui localização configurada." }, { status: 500 });
        }

        // 2. SEARCH CUSTOMER COORDS
        const customerCoords = await getCoordsFromCep(cep);
        if (!customerCoords) {
            return NextResponse.json({ error: "CEP não encontrado ou inválido" }, { status: 400 });
        }

        // 3. CALCULATE DISTANCE
        const distanceKm = getDistanceInKm(
            restaurant.latitude,
            restaurant.longitude,
            customerCoords.lat,
            customerCoords.lon
        );

        // 4. PROCESS RULES
        const rules: RadiusRule[] = (restaurant.delivery_fee_json || []).sort(
            (a: RadiusRule, b: RadiusRule) => a.radius_km - b.radius_km
        );

        let calculatedFee: number | null = null;
        let calculatedTime: number | null = null; // <-- TIME VARIABLE

        for (const rule of rules) {
            if (distanceKm <= rule.radius_km) {
                calculatedFee = rule.fee_cents;
                calculatedTime = rule.time_minutes; // <-- SAVES TIME RULE
                break; 
            }
        }

        // 5. VERIFY IF ITS OUT OF DELIVERY REACH
        if (calculatedFee === null) {
            return NextResponse.json({ error: "Fora da área de entrega" }, { status: 400 });
        }

        return NextResponse.json({
            delivery_fee_cents: calculatedFee,
            delivery_time_minutes: calculatedTime,
            distance_km: distanceKm,
        });

    } catch (error) {
        console.error("Erro ao calcular taxa de entrega:", error);
        return NextResponse.json(
            { error: "Erro interno no servidor" },
            { status: 500 }
        );
    }
}