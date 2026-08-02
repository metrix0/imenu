"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faQrcode,
    faRotate,
    faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";

import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

type WhatsAppConnection = {
    restaurant_id: string;
    session_name: string;
    desired_state: "connected" | "disconnected";
    status:
        | "STOPPED"
        | "STARTING"
        | "SCAN_QR_CODE"
        | "PASSKEY_REQUIRED"
        | "PASSKEY_CONFIRMATION_REQUIRED"
        | "WORKING"
        | "FAILED";
    status_data: { code?: string } | null;
    qr_code_data: string | null;
    last_connected_at: string | null;
    last_disconnected_at: string | null;
    last_error: string | null;
    updated_at: string;
};

export default function WhatsAppConnectionPopup() {
    const pathname = usePathname();
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [connection, setConnection] = useState<WhatsAppConnection | null>(null);
    const [loadingQr, setLoadingQr] = useState(false);
    const [dismissedIncident, setDismissedIncident] = useState<string | null>(null);

    useEffect(() => {
        if (pathname !== "/painel" && pathname !== "/painel/") return;

        const load = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session) return;

            let restId = restaurantId;
            if (!restId) {
                const { data: restaurant } = await supabase
                    .from("restaurants")
                    .select("id")
                    .eq("user_id", session.user.id)
                    .maybeSingle();

                if (!restaurant) return;
                const resolvedRestaurantId = String(restaurant.id);
                restId = resolvedRestaurantId;
                setRestaurantId(resolvedRestaurantId);
            }

            if (!restId) return;
            const resolvedRestaurantId = restId;

            const response = await fetch(
                `/api/whatsapp/connection?restaurantId=${encodeURIComponent(resolvedRestaurantId)}`,
                {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    cache: "no-store",
                }
            );

            if (!response.ok) return;
            const data = await response.json();
            setConnection(data.connection);
        };

        void load();
    }, [pathname, restaurantId, setRestaurantId]);

    useEffect(() => {
        if (!restaurantId) return;

        const channel = supabase
            .channel(`whatsapp-main-popup-${restaurantId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "whatsapp_connections",
                    filter: `restaurant_id=eq.${restaurantId}`,
                },
                (payload: any) => {
                    if (payload.eventType === "DELETE") {
                        setConnection(null);
                        return;
                    }

                    setConnection(payload.new as WhatsAppConnection);
                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [restaurantId]);

    const incidentKey = useMemo(() => {
        if (!connection) return null;
        return `${connection.status}:${connection.last_disconnected_at || "none"}`;
    }, [connection]);

    const hasConnectionProblem = Boolean(
        connection &&
            connection.desired_state === "connected" &&
            connection.last_connected_at &&
            connection.status !== "WORKING"
    );
    const open =
        (pathname === "/painel" || pathname === "/painel/") &&
        hasConnectionProblem &&
        incidentKey !== dismissedIncident;

    const generateNewQr = async () => {
        if (!restaurantId || loadingQr) return;

        const {
            data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        setLoadingQr(true);
        try {
            const response = await fetch("/api/whatsapp/connection", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    restaurantId,
                    action: "refresh_qr",
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setConnection(data.connection);
            }
        } finally {
            setLoadingQr(false);
        }
    };

    const close = () => {
        setDismissedIncident(incidentKey);
    };

    const needsQr =
        connection?.status === "SCAN_QR_CODE" ||
        connection?.status === "FAILED" ||
        connection?.status === "PASSKEY_REQUIRED";
    const needsPhoneConfirmation =
        connection?.status === "PASSKEY_CONFIRMATION_REQUIRED";

    return (
        <Modal open={open} onClose={close} className="max-w-lg">
            <div className="p-6 sm:p-8">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-50 text-xl text-amber-700">
                        <FontAwesomeIcon
                            icon={needsQr ? faQrcode : faTriangleExclamation}
                        />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            WhatsApp desconectado
                        </h2>
                        <p className="mt-1 text-sm text-gray-600">
                            {connection?.status === "PASSKEY_REQUIRED"
                                ? "O vínculo não foi concluído. Gere um novo QR Code e tente novamente."
                                : needsQr
                                  ? "A sessão expirou e precisa ser conectada novamente."
                                : needsPhoneConfirmation
                                  ? "O WhatsApp pediu uma confirmação no celular principal."
                                  : "O iMenu está tentando restaurar a conexão automaticamente."}
                        </p>
                    </div>
                </div>

                {needsQr && (
                    <div className="mt-6">
                        <div className="mx-auto flex min-h-[220px] w-[220px] items-center justify-center rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                            {connection?.qr_code_data ? (
                                <img
                                    src={connection.qr_code_data}
                                    alt="QR Code para reconectar o WhatsApp"
                                    className="h-48 w-48"
                                />
                            ) : (
                                <div className="text-center text-sm text-gray-500">
                                    Preparando o QR Code…
                                </div>
                            )}
                        </div>

                        <ol className="mt-5 list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
                            <li>Abra o WhatsApp no celular do restaurante.</li>
                            <li>Abra <b>Aparelhos conectados</b>.</li>
                            <li>Toque em <b>Conectar um aparelho</b>.</li>
                            <li>Escaneie este QR Code.</li>
                        </ol>
                    </div>
                )}

                {needsPhoneConfirmation && (
                    <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                        Confirme o vínculo no celular principal.
                        {connection?.status ===
                            "PASSKEY_CONFIRMATION_REQUIRED" &&
                            connection.status_data?.code && (
                                <span>
                                    {" "}O código mostrado deve ser <b>{connection.status_data.code}</b>.
                                </span>
                            )}
                    </div>
                )}

                {!needsQr && !needsPhoneConfirmation && (
                    <div className="mt-7 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
                        Reconectando automaticamente…
                    </div>
                )}

                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={close}>
                        Fechar
                    </Button>
                    {needsQr && (
                        <Button
                            onClick={generateNewQr}
                            loading={loadingQr}
                        >
                            <FontAwesomeIcon icon={faRotate} className="mr-2" />
                            Gerar novo QR
                        </Button>
                    )}
                    {!needsQr && !needsPhoneConfirmation && (
                        <div className="hidden items-center gap-2 text-sm font-medium text-green-700 sm:flex">
                            <FontAwesomeIcon icon={faWhatsapp} />
                            Sem atualização manual
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
