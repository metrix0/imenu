// app/api/checkout/calculate-fee/route.ts
import { query } from "@/lib/sql";
import { NextResponse } from "next/server";

// (Tipo RadiusRule e helper getDistanceInKm permanecem os mesmos)
type RadiusRule = {
    radius_km: number;
    time_minutes: number;
    fee_cents: number;
};
function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Raio da Terra
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distância em KM
}

// --- REMOVEMOS O 'getCoordsFromCep' ---
// (Não vamos mais adivinhar coordenadas a partir do CEP)

export async function POST(request: Request) {
    try {
        // --- CORREÇÃO AQUI ---
        // A API agora espera 'latitude' e 'longitude' do cliente, em vez de 'cep'
        const { restaurantId, latitude: customerLat, longitude: customerLon } = await request.json();

        if (!restaurantId || !customerLat || !customerLon) {
            return NextResponse.json({ error: "Dados incompletos (ID do restaurante ou localização do cliente)" }, { status: 400 });
        }
        // --- FIM DA CORREÇÃO ---

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

        // 2. SEARCH CUSTOMER COORDS (Não é mais necessário)

        // 3. CALCULATE DISTANCE
        const distanceKm = getDistanceInKm(
            parseFloat(restaurant.latitude),
            parseFloat(restaurant.longitude),
            customerLat, // Usa a coordenada enviada pelo cliente
            customerLon  // Usa a coordenada enviada pelo cliente
        );

        // 4. PROCESS RULES (Sem mudança)
        const rules: RadiusRule[] = (restaurant.delivery_fee_json || []).sort(
            (a: RadiusRule, b: RadiusRule) => a.radius_km - b.radius_km
        );
        let calculatedFee: number | null = null;
        let calculatedTime: number | null = null;
        for (const rule of rules) {
            if (distanceKm <= rule.radius_km) {
                calculatedFee = rule.fee_cents;
                calculatedTime = rule.time_minutes;
                break; 
            }
        }

        // 5. VERIFY IF ITS OUT OF DELIVERY REACH (Sem mudança)
        if (calculatedFee === null) {
            return NextResponse.json({ error: "Fora da área de entrega" }, { status: 400 });
        }

        // (Retorno - sem mudança)
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