import { NextResponse } from "next/server";
import { lookupCnefe } from "@/lib/delivery/cnefe";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    const address = body?.address;
    const origin = body?.origin;
    const fields = ["city", "uf", "street", "bairro", "number", "cep"] as const;
    if (!address || !fields.every(field => typeof address[field] === "string" && address[field].length <= 200) ||
        !/^[A-Z]{2}$/.test(address.uf) || !/^(?:\d{8})?$/.test(address.cep) ||
        !Number.isFinite(origin?.latitude) || !Number.isFinite(origin?.longitude) ||
        origin.latitude < -34 || origin.latitude > 6 || origin.longitude < -74 || origin.longitude > -28) {
        return NextResponse.json(null, { status: 400 });
    }
    return NextResponse.json(await lookupCnefe(address, origin));
}
