import { NextResponse } from "next/server";

import { query } from "@/lib/database/sql";
import { sendWahaText } from "@/lib/services/wahaClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

type ExpiringAddonRow = {
    restaurant_id: string;
    product_key: string;
    owner_phone: string | null;
    restaurant_phone: string | null;
};

type SupportConnectionRow = {
    session_name: string;
};

function isAuthorized(request: Request): boolean {
    const cronSecret = process.env.CRON_SECRET?.trim();
    return Boolean(
        cronSecret &&
            request.headers.get("authorization") === "Bearer " + cronSecret
    );
}

function businessDate(): string {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: BUSINESS_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return value.year + "-" + value.month + "-" + value.day;
}

function normalizeBrazilianPhone(value: unknown): string | null {
    let digits = String(value ?? "").replace(/\D/g, "");

    if (digits.startsWith("0055")) digits = digits.slice(2);
    if (digits.startsWith("055") && digits.length >= 13) digits = digits.slice(1);

    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
        return digits;
    }

    if (digits.length === 10 || digits.length === 11) {
        return "55" + digits;
    }

    return null;
}

function productName(productKey: string): string {
    const uppercaseWords = new Set(["qr", "ai", "api"]);

    return productKey
        .split("_")
        .filter(Boolean)
        .map((word) =>
            uppercaseWords.has(word.toLowerCase())
                ? word.toUpperCase()
                : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");
}

function buildMessage(productKeys: string[]): string {
    const names = productKeys.map(productName);
    const multiple = names.length > 1;

    return [
        "Olá! 👋",
        "",
        multiple
            ? "Seus adicionais abaixo vencem hoje:"
            : "Seu adicional *" + names[0] + "* vence hoje.",
        ...(multiple ? names.map((name) => "• *" + name + "*") : []),
        "",
        multiple
            ? "Como os pagamentos foram feitos via Pix, a renovação não é automática."
            : "Como o pagamento foi feito via Pix, a renovação não é automática.",
        "",
        "Acesse o painel do iMenu para renovar e continuar usando os recursos.",
    ].join("\n");
}

export async function GET(request: Request) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const support = await query<SupportConnectionRow>(
        "SELECT session_name FROM public.support_whatsapp_connection WHERE id = 'default' AND desired_state = 'connected' AND status = 'WORKING' LIMIT 1"
    );

    const sessionName = support.rows[0]?.session_name;
    if (!sessionName) {
        return NextResponse.json(
            { error: "WhatsApp de suporte não está conectado." },
            { status: 503 }
        );
    }

    const expiring = await query<ExpiringAddonRow>(
        "SELECT ra.restaurant_id, ra.product_key, u.raw_user_meta_data->>'phone' AS owner_phone, r.phone AS restaurant_phone FROM public.restaurant_addons ra JOIN public.restaurants r ON r.id = ra.restaurant_id LEFT JOIN auth.users u ON u.id = r.user_id WHERE ra.payment_provider = 'payzu' AND UPPER(COALESCE(ra.payzu_payment_method, '')) = 'PIX' AND ra.payzu_recurrence_id IS NULL AND ra.current_period_ends_at IS NOT NULL AND ra.status IN ('active', 'canceled', 'past_due') AND (ra.current_period_ends_at AT TIME ZONE 'America/Sao_Paulo')::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date ORDER BY ra.restaurant_id, ra.product_key"
    );

    const grouped = new Map<
        string,
        { phone: string | null; productKeys: string[] }
    >();

    for (const row of expiring.rows) {
        const current = grouped.get(row.restaurant_id) || {
            phone:
                normalizeBrazilianPhone(row.owner_phone) ||
                normalizeBrazilianPhone(row.restaurant_phone),
            productKeys: [],
        };

        current.productKeys.push(row.product_key);
        grouped.set(row.restaurant_id, current);
    }

    const date = businessDate();
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const [restaurantId, notification] of grouped) {
        if (!notification.phone) {
            skipped += 1;
            continue;
        }

        const chatId = notification.phone + "@c.us";
        const dedupeKey =
            "support:addon-expiry:" + restaurantId + ":" + date;

        const claim = await query(
            "INSERT INTO public.whatsapp_outbound_messages (dedupe_key, restaurant_id, chat_id, message_type, status, updated_at) VALUES ($1, $2, $3, 'text', 'sending', NOW()) ON CONFLICT (dedupe_key) DO NOTHING RETURNING dedupe_key",
            [dedupeKey, restaurantId, chatId]
        );

        if (claim.rowCount === 0) {
            skipped += 1;
            continue;
        }

        try {
            await sendWahaText(
                sessionName,
                chatId,
                buildMessage(notification.productKeys)
            );

            await query(
                "UPDATE public.whatsapp_outbound_messages SET status = 'sent', last_error = NULL, updated_at = NOW() WHERE dedupe_key = $1",
                [dedupeKey]
            );
            sent += 1;
        } catch (error) {
            await query(
                "UPDATE public.whatsapp_outbound_messages SET status = 'failed', last_error = $2, updated_at = NOW() WHERE dedupe_key = $1",
                [
                    dedupeKey,
                    error instanceof Error
                        ? error.message.slice(0, 500)
                        : "Falha ao enviar pelo WAHA",
                ]
            );
            failed += 1;
        }
    }

    return NextResponse.json({
        date,
        restaurants: grouped.size,
        sent,
        skipped,
        failed,
    });
}
