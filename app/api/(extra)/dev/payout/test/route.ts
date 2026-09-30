import { randomUUID } from "node:crypto";
import { transferMercadoPagoToAsaas } from "@/lib/services/mercadoPagoPayout";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { query } from "@/lib/database/sql";
import { asaasRequest } from "@/lib/services/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";
const RESTAURANT_TEST_AMOUNT_CENTS = 100;

type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

type RestaurantRow = {
    id: string;
    name: string | null;
    payment_info: string | null;
    payment_info_type: PixKeyType | null;
};

type AsaasTransfer = {
    id?: string;
    status?: string;
    failReason?: string | null;
};

function getBearerToken(request: Request): string | null {
    const authorization = request.headers.get("authorization")?.trim();
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
}

function getSupabasePublicConfig(): { url: string; anonKey: string } {
    const url =
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
        process.env.SUPABASE_URL?.trim();
    const anonKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
        process.env.SUPABASE_ANON_KEY?.trim();

    if (!url || !anonKey) {
        throw new Error("Supabase public environment variables are missing.");
    }

    return { url, anonKey };
}

async function authorize(request: Request): Promise<NextResponse | null> {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
        return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { url, anonKey } = getSupabasePublicConfig();
    const authClient = createClient(url, anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });

    const {
        data: { user },
        error,
    } = await authClient.auth.getUser(accessToken);

    if (error || !user) {
        return NextResponse.json(
            { error: "Sessão inválida ou expirada." },
            { status: 401 }
        );
    }

    if (user.email?.trim().toLowerCase() !== ALLOWED_DEV_EMAIL) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    return null;
}

function inferPixKeyType(value: string | null): PixKeyType | null {
    const raw = String(value || "").trim();
    if (!raw) return null;

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
        return "EVP";
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return "EMAIL";
    if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(raw)) return "CNPJ";
    if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(raw)) return "CPF";
    if (/^\+55\D*\d{2}\D*\d{8,9}$/.test(raw) || /^\(\d{2}\)\s*\d{4,5}-?\d{4}$/.test(raw)) {
        return "PHONE";
    }

    const digits = raw.replace(/\D/g, "");
    if (digits.length === 14) return "CNPJ";
    if (digits.length === 13 && digits.startsWith("55")) return "PHONE";
    return null;
}

function normalizePixKey(value: string, type: PixKeyType): string {
    const raw = value.trim();
    if (type === "EMAIL" || type === "EVP") return raw;

    let digits = raw.replace(/\D/g, "");
    if (type === "PHONE" && digits.length === 13 && digits.startsWith("55")) {
        digits = digits.slice(2);
    }
    return digits;
}

function resolvePixKeyType(row: RestaurantRow): PixKeyType | null {
    return row.payment_info_type || inferPixKeyType(row.payment_info);
}

async function getAsaasBalanceCents(): Promise<number> {
    const payload = await asaasRequest<{ balance?: number }>("/finance/balance");
    const balance = Number(payload.balance);
    if (!Number.isFinite(balance)) {
        throw new Error("Saldo inválido retornado pelo Asaas.");
    }
    return Math.round(balance * 100);
}

export async function GET(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;

    try {
        const { rows } = await query<RestaurantRow>(
            `
            SELECT id, name, payment_info, payment_info_type
            FROM public.restaurants
            WHERE payment_info IS NOT NULL
              AND BTRIM(payment_info) <> ''
            ORDER BY COALESCE(name, 'Restaurante') ASC
            `
        );

        return NextResponse.json({
            restaurants: rows
                .filter((row) => Boolean(resolvePixKeyType(row)))
                .map((row) => ({
                    id: row.id,
                    name: row.name || "Restaurante",
                    pixKeyType: resolvePixKeyType(row),
                })),
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erro interno." },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;

    let body: { action?: unknown; restaurantId?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }

    if (body.action === "mercadopago_to_asaas") {
        try {
            const transfer = await transferMercadoPagoToAsaas({ amountCents: 100, clientReference: `imenu-mp-test-${randomUUID()}` });
            return NextResponse.json({ success: true, action: "mercadopago_to_asaas", ...transfer });
        } catch (error) {
            return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno." }, { status: 500 });
        }
    }

    if (body.action === "restaurant") {
        const restaurantId = String(body.restaurantId || "").trim();
        if (!restaurantId) {
            return NextResponse.json(
                { error: "Selecione um restaurante." },
                { status: 400 }
            );
        }

        try {
            const { rows } = await query<RestaurantRow>(
                `
                SELECT id, name, payment_info, payment_info_type
                FROM public.restaurants
                WHERE id = $1
                LIMIT 1
                `,
                [restaurantId]
            );
            const restaurant = rows[0];
            if (!restaurant) {
                return NextResponse.json(
                    { error: "Restaurante não encontrado." },
                    { status: 404 }
                );
            }

            const keyType = resolvePixKeyType(restaurant);
            if (!restaurant.payment_info || !keyType) {
                return NextResponse.json(
                    { error: "O restaurante não possui uma chave PIX válida." },
                    { status: 409 }
                );
            }

            const balanceCents = await getAsaasBalanceCents();
            if (balanceCents < RESTAURANT_TEST_AMOUNT_CENTS) {
                return NextResponse.json(
                    {
                        error: "Saldo Asaas insuficiente para o teste de R$ 1,00.",
                        balanceCents,
                    },
                    { status: 409 }
                );
            }

            const transfer = await asaasRequest<AsaasTransfer>("/transfers", {
                method: "POST",
                body: JSON.stringify({
                    value: RESTAURANT_TEST_AMOUNT_CENTS / 100,
                    operationType: "PIX",
                    pixAddressKey: normalizePixKey(
                        restaurant.payment_info,
                        keyType
                    ),
                    pixAddressKeyType: keyType,
                    description: `Teste repasse iMenu - ${restaurant.name || "Restaurante"}`.slice(0, 140),
                    externalReference: `imenu-payout-test-${randomUUID()}`,
                }),
            });

            if (transfer.status === "CANCELLED") {
                return NextResponse.json(
                    {
                        error:
                            transfer.failReason ||
                            "Transferência de teste cancelada pelo Asaas.",
                    },
                    { status: 409 }
                );
            }

            return NextResponse.json({
                success: true,
                action: "restaurant",
                amountCents: RESTAURANT_TEST_AMOUNT_CENTS,
                restaurantId: restaurant.id,
                restaurantName: restaurant.name || "Restaurante",
                transactionId: transfer.id || null,
                transactionStatus: transfer.status || null,
            });
        } catch (error) {
            return NextResponse.json(
                { error: error instanceof Error ? error.message : "Erro interno." },
                { status: 500 }
            );
        }
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}