"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChartLine,
    faCircleCheck,
    faCreditCard,
    faLink,
    faPowerOff,
    faQrcode,
    faRotate,
    faTruck,
    faUser,
    faUtensils,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";

import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Toast from "@/components/ui/Toast";
import ListLoader from "@/components/ui/ListLoader";
import Card from "@/components/ui/Card";

const extractFirst = (value: string, pattern: RegExp) =>
    value.toUpperCase().match(pattern)?.[0] ?? "";

const cleanGa4Id = (value: string) => extractFirst(value, /G-[A-Z0-9]+/);

const cleanGoogleManagerIds = (value: string) => {
    const upper = value.toUpperCase();
    const ids = [
        upper.match(/GTM-[A-Z0-9]+/)?.[0],
        upper.match(/AW-[0-9]+/)?.[0],
    ].filter((id): id is string => Boolean(id));

    return [...new Set(ids)].join(", ");
};

const cleanMetaPixelId = (value: string) =>
    value.trim().match(/^[0-9]{5,25}$/)?.[0] ?? "";

type ActiveTab = "tracking" | "whatsapp";

type RestaurantInfo = {
    id: string;
    name: string;
    url_slug: string | null;
};

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
    phone: string | null;
    push_name: string | null;
    qr_code_data: string | null;
    qr_updated_at: string | null;
    last_connected_at: string | null;
    last_disconnected_at: string | null;
    last_restart_at: string | null;
    last_event_at: string | null;
    last_error: string | null;
    updated_at: string;
};

function formatPhone(value: string | null): string {
    const digits = String(value || "").replace(/\D/g, "");
    const local = digits.startsWith("55") ? digits.slice(2) : digits;

    if (local.length === 11) {
        return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
    }

    if (local.length === 10) {
        return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
    }

    return value || "Número conectado";
}

function connectionPresentation(connection: WhatsAppConnection | null) {
    if (!connection || connection.desired_state === "disconnected") {
        return {
            label: "Não conectado",
            badge: "bg-gray-100 text-gray-600",
            description: "Conecte o WhatsApp do restaurante pelo QR Code.",
        };
    }

    switch (connection.status) {
        case "WORKING":
            return {
                label: "Conectado",
                badge: "bg-green-50 text-green-700",
                description: "O atendimento automático está funcionando.",
            };
        case "SCAN_QR_CODE":
            return {
                label: "Escaneie o QR",
                badge: "bg-blue-50 text-blue-700",
                description: "Abra os aparelhos conectados no WhatsApp e escaneie o código.",
            };
        case "PASSKEY_REQUIRED":
            return {
                label: "Novo QR necessário",
                badge: "bg-blue-50 text-blue-700",
                description: "Gere um novo QR Code para tentar o vínculo novamente.",
            };
        case "PASSKEY_CONFIRMATION_REQUIRED":
            return {
                label: "Confirme no celular",
                badge: "bg-blue-50 text-blue-700",
                description: "O WhatsApp pediu uma confirmação no aparelho principal.",
            };
        case "FAILED":
            return {
                label: "Reconexão necessária",
                badge: "bg-red-50 text-red-700",
                description: "Gere um novo QR Code para reconectar o número.",
            };
        case "STARTING":
            return {
                label: "Conectando",
                badge: "bg-amber-50 text-amber-700",
                description: "A conexão está sendo iniciada automaticamente.",
            };
        default:
            return {
                label: "Reconectando",
                badge: "bg-amber-50 text-amber-700",
                description: "O sistema está tentando restaurar a conexão.",
            };
    }
}

export default function IntegracoesPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();

    const [activeTab, setActiveTab] = useState<ActiveTab>("whatsapp");
    const [isLocalhost, setIsLocalhost] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [whatsAppAction, setWhatsAppAction] = useState<
        "connect" | "refresh_qr" | "disconnect" | null
    >(null);
    const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
    const [connection, setConnection] = useState<WhatsAppConnection | null>(null);

    const [tracking, setTracking] = useState({
        ga4_id: "",
        gtm_id: "",
        meta_pixel_id: "",
        is_enabled: true,
    });

    const [showToast, setShowToast] = useState(false);
    const [toastConfig, setToastConfig] = useState<{
        message: string;
        type: "success" | "error";
    }>({
        message: "",
        type: "success",
    });

    const showMessage = (message: string, type: "success" | "error") => {
        setToastConfig({ message, type });
        setShowToast(true);
    };

    useEffect(() => {
        const hostname = window.location.hostname;
        setIsLocalhost(
            hostname === "localhost" ||
                hostname === "127.0.0.1" ||
                hostname === "::1" ||
                hostname === "preview.imenuapp.com.br"
        );
    }, []);

    const getAuthenticatedSession = async () => {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
            showMessage("Sua sessão expirou. Entre novamente.", "error");
            return null;
        }

        return session;
    };

    useEffect(() => {
        if (isLocalhost === null) return;

        const loadRestaurantAndIntegrations = async () => {
            const session = await getAuthenticatedSession();
            if (!session?.user) {
                setLoading(false);
                return;
            }

            let restId = restaurantId;

            if (!restId) {
                const { data: restaurantData } = await supabase
                    .from("restaurants")
                    .select("id")
                    .eq("user_id", session.user.id)
                    .single();

                if (!restaurantData) {
                    setLoading(false);
                    return;
                }

                const resolvedRestaurantId = String(restaurantData.id);
                restId = resolvedRestaurantId;
                setRestaurantId(resolvedRestaurantId);
            }

            if (!restId) {
                setLoading(false);
                return;
            }

            const resolvedRestaurantId = restId;

            const trackingRequest = supabase
                .from("tracking_integrations")
                .select("*")
                .eq("restaurant_id", resolvedRestaurantId)
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            const connectionRequest = isLocalhost
                ? fetch(
                      `/api/whatsapp/connection?restaurantId=${encodeURIComponent(resolvedRestaurantId)}`,
                      {
                          headers: {
                              Authorization: `Bearer ${session.access_token}`,
                          },
                          cache: "no-store",
                      }
                  )
                : Promise.resolve<Response | null>(null);
            const [trackingResult, connectionResponse] = await Promise.all([
                trackingRequest,
                connectionRequest,
            ]);

            if (trackingResult.data) {
                setTracking({
                    ga4_id: cleanGa4Id(trackingResult.data.ga4_id || ""),
                    gtm_id: cleanGoogleManagerIds(
                        `${trackingResult.data.gtm_id || ""} ${
                            trackingResult.data.ga4_id || ""
                        }`
                    ),
                    meta_pixel_id: cleanMetaPixelId(
                        trackingResult.data.meta_pixel_id || ""
                    ),
                    is_enabled: trackingResult.data.is_enabled,
                });
            }

            if (connectionResponse?.ok) {
                const data = await connectionResponse.json();
                setRestaurant(data.restaurant);
                setConnection(data.connection);
            } else if (connectionResponse) {
                const data = await connectionResponse.json().catch(() => ({}));
                showMessage(
                    data.error || "Não foi possível carregar a conexão do WhatsApp.",
                    "error"
                );
            }

            setLoading(false);
        };

        void loadRestaurantAndIntegrations();
    }, [isLocalhost, restaurantId, setRestaurantId]);

    useEffect(() => {
        if (!isLocalhost || !restaurantId) return;

        const channel = supabase
            .channel(`whatsapp-connection-page-${restaurantId}`)
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
    }, [isLocalhost, restaurantId]);

    const saveTracking = async () => {
        if (!restaurantId || saving) return;

        setSaving(true);

        const cleanTracking = {
            ga4_id: cleanGa4Id(tracking.ga4_id) || null,
            gtm_id: cleanGoogleManagerIds(tracking.gtm_id) || null,
            meta_pixel_id: cleanMetaPixelId(tracking.meta_pixel_id) || null,
            is_enabled: tracking.is_enabled,
        };

        const { error } = await supabase.from("tracking_integrations").upsert(
            {
                restaurant_id: restaurantId,
                ...cleanTracking,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "restaurant_id" }
        );

        if (error) {
            console.error("[TRACKING] Erro ao salvar integrações:", error);
            showMessage("Erro ao salvar integrações.", "error");
        } else {
            setTracking({
                ga4_id: cleanTracking.ga4_id || "",
                gtm_id: cleanTracking.gtm_id || "",
                meta_pixel_id: cleanTracking.meta_pixel_id || "",
                is_enabled: cleanTracking.is_enabled,
            });
            showMessage("Integrações salvas com sucesso!", "success");
        }

        setSaving(false);
    };

    const runWhatsAppAction = async (
        action: "connect" | "refresh_qr" | "disconnect"
    ) => {
        if (!isLocalhost || !restaurantId || whatsAppAction) return;

        if (
            action === "disconnect" &&
            !window.confirm(
                "Desconectar este número? O atendimento automático parará imediatamente."
            )
        ) {
            return;
        }

        const session = await getAuthenticatedSession();
        if (!session) return;

        setWhatsAppAction(action);

        try {
            const response = await fetch("/api/whatsapp/connection", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ restaurantId, action }),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Não foi possível atualizar a conexão.");
            }

            setRestaurant(data.restaurant);
            setConnection(data.connection);

            if (action === "disconnect") {
                showMessage("WhatsApp desconectado.", "success");
            }
        } catch (error) {
            showMessage(
                error instanceof Error
                    ? error.message
                    : "Não foi possível atualizar a conexão.",
                "error"
            );
        } finally {
            setWhatsAppAction(null);
        }
    };

    const status = useMemo(
        () => connectionPresentation(connection),
        [connection]
    );
    const showQr =
        connection?.desired_state === "connected" &&
        (connection.status === "SCAN_QR_CODE" || connection.status === "FAILED");
    const isConnected =
        connection?.desired_state === "connected" && connection.status === "WORKING";

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <ListLoader lines={4} />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6">
            <h1 className="mb-2 text-3xl font-bold text-gray-900">
                Integrações
            </h1>

            <p className="mb-6 text-gray-600">
                Conecte ferramentas externas ao seu restaurante.
            </p>

            <div className="mb-8 flex gap-2 rounded-lg border border-gray-200 bg-white p-1">
                <button
                    type="button"
                    onClick={() => setActiveTab("whatsapp")}
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                        activeTab === "whatsapp"
                            ? "bg-brand text-white"
                            : "text-gray-600 hover:bg-gray-50"
                    }`}
                >
                    <FontAwesomeIcon icon={faWhatsapp} />
                    WhatsApp
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("tracking")}
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                        activeTab === "tracking"
                            ? "bg-brand text-white"
                            : "text-gray-600 hover:bg-gray-50"
                    }`}
                >
                    <FontAwesomeIcon icon={faChartLine} />
                    Rastreamento
                </button>
            </div>

            {activeTab === "tracking" && (
                <Card className="space-y-6 border border-gray-200 p-7 pr-10">
                    <h2 className="mb-2 text-xl font-semibold text-gray-900">
                        Analytics e Rastreamento
                    </h2>

                    <div className="flex items-center gap-4">
                        <Image
                            src="/logos/google-analytics.svg"
                            alt="Google Analytics"
                            width={36}
                            height={36}
                        />
                        <div className="flex-1">
                            <Input
                                label="Google Analytics (GA4)"
                                placeholder="G-XXXXXXXXXX"
                                value={tracking.ga4_id}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    setTracking({
                                        ...tracking,
                                        ga4_id: e.target.value,
                                    })
                                }
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                Use o ID da métrica que começa com G-. Não cole o
                                código HTML completo.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <Image
                            src="/logos/google-tag-manager.svg"
                            alt="Google Tag Manager"
                            width={36}
                            height={36}
                        />
                        <div className="flex-1">
                            <Input
                                label="Google Tag Manager / Google Ads"
                                placeholder="GTM-XXXXXXX ou AW-XXXXXXXXXX"
                                value={tracking.gtm_id}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    setTracking({
                                        ...tracking,
                                        gtm_id: e.target.value,
                                    })
                                }
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                Aceita GTM-, AW- ou os dois separados por vírgula.
                                Não cole o código HTML completo.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <Image
                            src="/logos/meta.svg"
                            alt="Meta / Facebook"
                            width={36}
                            height={36}
                        />
                        <div className="flex-1">
                            <Input
                                label="Meta (Facebook/Instagram) Pixel"
                                placeholder="123456789012345"
                                value={tracking.meta_pixel_id}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    setTracking({
                                        ...tracking,
                                        meta_pixel_id: e.target.value,
                                    })
                                }
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                Acompanhe conversões e anúncios no Instagram e
                                Facebook.
                            </p>
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button onClick={saveTracking} loading={saving}>
                            Salvar Integrações
                        </Button>
                    </div>
                </Card>
            )}

            {activeTab === "whatsapp" &&
                (isLocalhost ? (
                    <div className="space-y-6">
                    <Card className="border border-gray-200 p-7">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-50 text-2xl text-green-600">
                                <FontAwesomeIcon icon={faWhatsapp} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        WhatsApp do restaurante
                                    </h2>
                                    <span
                                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.badge}`}
                                    >
                                        {status.label}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm text-gray-600">
                                    {status.description}
                                </p>
                                {isConnected && (
                                    <p className="mt-2 text-sm font-medium text-gray-800">
                                        {connection?.push_name || restaurant?.name}
                                        {connection?.phone
                                            ? ` · ${formatPhone(connection.phone)}`
                                            : ""}
                                    </p>
                                )}
                            </div>
                        </div>

                        {!connection || connection.desired_state === "disconnected" ? (
                            <div className="mt-7">
                                <Button
                                    onClick={() => runWhatsAppAction("connect")}
                                    loading={whatsAppAction === "connect"}
                                >
                                    <FontAwesomeIcon icon={faQrcode} className="mr-2" />
                                    Conectar WhatsApp
                                </Button>
                            </div>
                        ) : (
                            <div className="mt-7 flex flex-wrap gap-3">
                                {(connection.status === "FAILED" ||
                                    connection.status === "SCAN_QR_CODE" ||
                                    connection.status === "PASSKEY_REQUIRED") && (
                                    <Button
                                        onClick={() => runWhatsAppAction("refresh_qr")}
                                        loading={whatsAppAction === "refresh_qr"}
                                    >
                                        <FontAwesomeIcon icon={faRotate} className="mr-2" />
                                        Gerar novo QR Code
                                    </Button>
                                )}
                                <Button
                                    variant="secondary"
                                    onClick={() => runWhatsAppAction("disconnect")}
                                    loading={whatsAppAction === "disconnect"}
                                >
                                    <FontAwesomeIcon icon={faPowerOff} className="mr-2" />
                                    Desconectar
                                </Button>
                            </div>
                        )}
                    </Card>

                    <div
                        className={`grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out ${
                            showQr
                                ? "grid-rows-[1fr] translate-y-0 opacity-100"
                                : "pointer-events-none grid-rows-[0fr] -translate-y-2 opacity-0"
                        }`}
                        aria-hidden={!showQr}
                    >
                        <div className="min-h-0 overflow-hidden">
                            <Card className="border border-blue-200 bg-blue-50/40 p-7">
                                <div className="grid items-center gap-7 sm:grid-cols-[220px_1fr]">
                                    <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                                        {connection?.qr_code_data ? (
                                            <img
                                                src={connection.qr_code_data}
                                                alt="QR Code para conectar o WhatsApp"
                                                className="h-48 w-48"
                                            />
                                        ) : (
                                            <div className="text-center text-sm text-gray-500">
                                                Preparando o novo QR Code…
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            Escaneie pelo celular do restaurante
                                        </h3>
                                        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
                                            <li>Abra o WhatsApp no celular.</li>
                                            <li>
                                                Toque no menu <b>⋮</b> no Android ou em
                                                <b> Configurações</b> no iPhone.
                                            </li>
                                            <li>Toque em <b>Aparelhos conectados</b>.</li>
                                            <li>Toque em <b>Conectar um aparelho</b>.</li>
                                            <li>Aponte a câmera para este QR Code.</li>
                                        </ol>
                                        <p className="mt-4 text-xs text-gray-500">
                                            O código muda automaticamente quando expira. Esta
                                            tela é atualizada em tempo real, sem precisar
                                            recarregar a página.
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>

                    {connection?.status === "PASSKEY_CONFIRMATION_REQUIRED" && (
                        <Card className="border border-blue-200 bg-blue-50 p-6">
                            <p className="font-semibold text-gray-900">
                                Confirme o código no celular
                            </p>
                            <p className="mt-2 text-sm text-gray-700">
                                Confira se o código exibido pelo WhatsApp é
                                <b> {connection.status_data?.code || "o mesmo mostrado no aparelho"}</b>
                                e confirme no celular.
                            </p>
                        </Card>
                    )}

                    <Card className="border border-gray-200 p-7">
                        <h3 className="text-lg font-semibold text-gray-900">
                            O que o atendimento faz
                        </h3>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            {[
                                {
                                    icon: faUtensils,
                                    title: "Cardápio e preços",
                                    text: "Responde com os itens disponíveis, preços atuais e o link do cardápio.",
                                },
                                {
                                    icon: faTruck,
                                    title: "Entrega",
                                    text: "Explica taxas, distâncias, prazos, retirada e pedido mínimo configurados no iMenu.",
                                },
                                {
                                    icon: faCreditCard,
                                    title: "Pagamentos",
                                    text: "Informa as formas de pagamento habilitadas no restaurante.",
                                },
                                {
                                    icon: faLink,
                                    title: "Link para pedir",
                                    text: "Direciona o cliente para finalizar o pedido no iMenu.",
                                },
                                {
                                    icon: faUser,
                                    title: "Atendimento humano",
                                    text: "Para de responder quando o cliente pede uma pessoa ou quando o dono entra na conversa.",
                                },
                                {
                                    icon: faCircleCheck,
                                    title: "Reconexão automática",
                                    text: "Tenta restaurar a sessão após quedas e pede um novo QR somente quando necessário.",
                                },
                            ].map((feature) => (
                                <div
                                    key={feature.title}
                                    className="flex gap-3 rounded-lg border border-gray-200 p-4"
                                >
                                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                                        <FontAwesomeIcon icon={feature.icon} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">
                                            {feature.title}
                                        </p>
                                        <p className="mt-1 text-sm text-gray-600">
                                            {feature.text}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                    </div>
                ) : (
                    <Card className="border border-gray-200 p-7 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-2xl text-green-600">
                            <FontAwesomeIcon icon={faWhatsapp} />
                        </div>
                        <p className="mt-4 font-medium text-gray-700">
                            Em desenvolvimento, previsão de adição 1 dia
                        </p>
                    </Card>
                ))}

            {showToast && (
                <Toast
                    message={toastConfig.message}
                    type={toastConfig.type}
                    onClose={() => setShowToast(false)}
                />
            )}
        </div>
    );
}
