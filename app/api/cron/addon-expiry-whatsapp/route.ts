import { NextResponse } from "next/server";

import { query } from "@/lib/database/sql";
import { sendWahaText } from "@/lib/services/wahaClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

type ExpiringAddonRow = {
    restaurant_id: string;
    product_key: string;
    reminder_kind: "pix" | "card";
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
    if (productKey === "ia_plus") return "iMenu Plus";
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

type ReminderProducts = { pix: string[]; card: string[] };

function buildMessage(products: ReminderProducts): string {
    const pixNames = products.pix.map(productName);
    const cardNames = products.card.map(productName);
    const lines = ["Olá! 👋", ""];

    if (pixNames.length) {
        lines.push(
            pixNames.length > 1
                ? "O período dos seus adicionais abaixo termina hoje:"
                : "O período do seu adicional *" + pixNames[0] + "* termina hoje."
        );
        if (pixNames.length > 1) {
            lines.push(...pixNames.map((name) => "• *" + name + "*"));
        }
        lines.push(
            "",
            "A renovação via Pix não é automática. Você tem *1 dia de tolerância* para renovar sem perder acesso."
        );
    }

    if (cardNames.length) {
        if (pixNames.length) lines.push("");
        lines.push(
            cardNames.length > 1
                ? "As assinaturas dos adicionais abaixo foram canceladas:"
                : "A assinatura do seu adicional *" + cardNames[0] + "* foi cancelada."
        );
        if (cardNames.length > 1) {
            lines.push(...cardNames.map((name) => "• *" + name + "*"));
        }
        lines.push(
            "",
            "O acesso vence amanhã e não haverá renovação automática no cartão."
        );
    }

    lines.push(
        "",
        "Acesse a aba Configurações no iMenu para renovar e continuar usando os recursos. imenuapp.com.br/painel/configuracoes",
        "",
        "Fico à disposição caso precise de ajuda!"
    );
    return lines.join("\n");
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
        `
        SELECT
            ra.restaurant_id,
            ra.product_key,
            CASE WHEN ra.payment_provider = 'asaas' THEN 'card' ELSE 'pix' END AS reminder_kind,
            u.raw_user_meta_data->>'phone' AS owner_phone,
            r.phone AS restaurant_phone
        FROM public.restaurant_addons ra
        JOIN public.restaurants r ON r.id = ra.restaurant_id
        LEFT JOIN auth.users u ON u.id = r.user_id
        WHERE ra.current_period_ends_at IS NOT NULL
          AND (ra.current_period_ends_at AT TIME ZONE 'America/Sao_Paulo')::date =
              (NOW() AT TIME ZONE 'America/Sao_Paulo')::date + 1
          AND (
              (
                  (
                      ra.payment_provider = 'mercadopago'
                      OR (
                          ra.payment_provider = 'payzu'
                          AND UPPER(COALESCE(ra.payzu_payment_method, '')) = 'PIX'
                          AND ra.payzu_recurrence_id IS NULL
                      )
                  )
                  AND ra.status IN ('active', 'canceled', 'past_due')
              )
              OR (
                  ra.payment_provider = 'asaas'
                  AND ra.status = 'canceled'
                  AND ra.asaas_subscription_id IS NOT NULL
                  AND EXISTS (
                      SELECT 1
                      FROM public.restaurant_addon_payments payment
                      WHERE payment.addon_id = ra.id
                        AND UPPER(COALESCE(payment.billing_type, '')) = 'CREDIT_CARD'
                        AND (
                            payment.paid_at IS NOT NULL
                            OR UPPER(COALESCE(payment.status, '')) IN
                                ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH')
                        )
                  )
              )
          )
          AND ra.product_key = 'ia_plus'
        ORDER BY ra.restaurant_id, ra.product_key
        `
    );

    const grouped = new Map<
        string,
        { phone: string | null; products: ReminderProducts }
    >();

    for (const row of expiring.rows) {
        const current = grouped.get(row.restaurant_id) || {
            phone:
                normalizeBrazilianPhone(row.owner_phone) ||
                normalizeBrazilianPhone(row.restaurant_phone),
            products: { pix: [], card: [] },
        };

        current.products[row.reminder_kind].push(row.product_key);
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
                buildMessage(notification.products)
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
