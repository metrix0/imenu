import { query } from "@/lib/database/sql";
import {
    checkWahaPhoneExists,
    sendWahaText,
} from "@/lib/services/wahaClient";

type AddonPurchaseRow = {
    restaurant_id: string;
    product_key: "ia_plus" | "qr_code_mesa";
    owner_phone: string | null;
    restaurant_phone: string | null;
    successful_payments: number;
    current_payment_confirmed: boolean;
};

type SupportConnectionRow = {
    session_name: string;
};

const ADDON_PURCHASE_MESSAGES: Record<AddonPurchaseRow["product_key"], string> = {
    ia_plus: [
        "Oi! Tudo bem? Sou a Ellen, do iMenu 🍔",
        "",
        "Vi que você acabou de assinar o *iMenu IA Plus*! Muito obrigado pela confiança! 💙",
        "",
        "*BÔNUS:* Temos um bônus para você. Com o IA Plus você ganha atendimento preferencial e a possibilidade de requisitar modificações e integrações no sistema! Essas requisições podem ser feitas por aqui mesmo! 🚀",
        "",
        "Ficamos à disposição para ajudar com o que necessário.",
    ].join("\n"),
    qr_code_mesa: [
        "Oi! Tudo bem? Sou a Ellen, do iMenu 🍔",
        "",
        "Vi que você acabou de adquirir o *iMenu QR Code*! Muito obrigado pela confiança! 💙",
        "",
        "Seu QR Code já está liberado e pronto para usar. Você pode imprimir e colocar nas mesas, balcão, embalagens ou onde preferir para levar seus clientes direto ao cardápio. 📲",
        "",
        "Se precisar de ajuda para configurar ou usar, pode chamar por aqui! 🚀",
    ].join("\n"),
};

function normalizeBrazilianPhone(value: unknown): string | null {
    let digits = String(value ?? "").replace(/\D/g, "");

    if (digits.startsWith("0055")) digits = digits.slice(2);
    if (digits.startsWith("055") && digits.length >= 13) digits = digits.slice(1);

    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
        return digits;
    }

    if (digits.length === 10 || digits.length === 11) {
        return `55${digits}`;
    }

    return null;
}

export async function sendAddonPurchaseWhatsApp(input: {
    addonId: string;
    paymentId: string;
}): Promise<void> {
    const dedupeKey = `support:addon-purchase:${input.addonId}`;
    let claimed = false;

    try {
        const addonResult = await query<AddonPurchaseRow>(
            `
                SELECT
                    addon.restaurant_id,
                    addon.product_key,
                    owner.raw_user_meta_data->>'phone' AS owner_phone,
                    restaurant.phone AS restaurant_phone,
                    (
                        SELECT COUNT(*)::int
                        FROM public.restaurant_addon_payments AS payment
                        WHERE payment.addon_id = addon.id
                          AND (
                                payment.paid_at IS NOT NULL
                                OR UPPER(COALESCE(payment.status, '')) IN (
                                    'APPROVED',
                                    'CONFIRMED',
                                    'RECEIVED',
                                    'COMPLETED'
                                )
                              )
                    ) AS successful_payments,
                    EXISTS (
                        SELECT 1
                        FROM public.restaurant_addon_payments AS payment
                        WHERE payment.addon_id = addon.id
                          AND payment.asaas_payment_id = $2
                          AND (
                                payment.paid_at IS NOT NULL
                                OR UPPER(COALESCE(payment.status, '')) IN (
                                    'APPROVED',
                                    'CONFIRMED',
                                    'RECEIVED',
                                    'COMPLETED'
                                )
                              )
                    ) AS current_payment_confirmed
                FROM public.restaurant_addons AS addon
                JOIN public.restaurants AS restaurant
                  ON restaurant.id = addon.restaurant_id
                LEFT JOIN auth.users AS owner
                  ON owner.id = restaurant.user_id
                WHERE addon.id = $1
                  AND addon.product_key IN ('ia_plus', 'qr_code_mesa')
                LIMIT 1
            `,
            [input.addonId, input.paymentId]
        );

        const addon = addonResult.rows[0];
        if (
            !addon ||
            !addon.current_payment_confirmed ||
            Number(addon.successful_payments) !== 1
        ) {
            return;
        }

        const phone =
            normalizeBrazilianPhone(addon.owner_phone) ||
            normalizeBrazilianPhone(addon.restaurant_phone);
        if (!phone) {
            console.warn("[ADDON_PURCHASE_WHATSAPP] Telefone não encontrado:", {
                addonId: input.addonId,
            });
            return;
        }

        const chatId = phone + "@c.us";
        const claim = await query(
            `
                INSERT INTO public.whatsapp_outbound_messages (
                    dedupe_key,
                    restaurant_id,
                    chat_id,
                    message_type,
                    status,
                    updated_at
                )
                VALUES ($1, $2, $3, 'text', 'sending', NOW())
                ON CONFLICT (dedupe_key) DO NOTHING
                RETURNING dedupe_key
            `,
            [dedupeKey, addon.restaurant_id, chatId]
        );

        if (claim.rowCount === 0) return;
        claimed = true;

        const support = await query<SupportConnectionRow>(
            "SELECT session_name FROM public.support_whatsapp_connection WHERE id = 'default' AND desired_state = 'connected' AND status = 'WORKING' LIMIT 1"
        );
        const sessionName = support.rows[0]?.session_name;
        if (!sessionName) {
            throw new Error("WhatsApp principal não está conectado.");
        }

        const contact = await checkWahaPhoneExists(sessionName, phone);
        if (!contact.numberExists) {
            throw new Error("Número não existe no WhatsApp.");
        }

        const resolvedChatId = contact.chatId || chatId;
        await sendWahaText(
            sessionName,
            resolvedChatId,
            ADDON_PURCHASE_MESSAGES[addon.product_key]
        );

        await query(
            "UPDATE public.whatsapp_outbound_messages SET chat_id = $2, status = 'sent', last_error = NULL, updated_at = NOW() WHERE dedupe_key = $1",
            [dedupeKey, resolvedChatId]
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message.slice(0, 500) : "Falha ao enviar pelo WAHA";

        if (claimed) {
            await query(
                "UPDATE public.whatsapp_outbound_messages SET status = 'failed', last_error = $2, updated_at = NOW() WHERE dedupe_key = $1",
                [dedupeKey, message]
            ).catch(() => undefined);
        }

        console.error("[ADDON_PURCHASE_WHATSAPP] Falha no envio:", error);
    }
}
