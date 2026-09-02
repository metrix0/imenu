"use client";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type MutableRefObject,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChevronDown,
    faCircleCheck,
    faCreditCard,
    faLink,
    faPlus,
    faPowerOff,
    faQrcode,
    faRotate,
    faTruck,
    faUser,
    faUtensils,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ListLoader from "@/components/ui/ListLoader";
import Toast from "@/components/ui/Toast";
import { supabase } from "@/lib/database/supabaseClient";
import type {
    WhatsAppMessageTemplates,
    WhatsAppTemplateKey,
} from "@/lib/services/whatsappMessageTemplates";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

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

type TemplateVariable = {
    key: string;
    label: string;
    token: string;
    value: string;
};

type HumanConversation = {
    chat_id: string;
    customer_name: string | null;
    last_owner_message_at: string | null;
    updated_at: string;
};

type TemplateField = {
    key: WhatsAppTemplateKey;
    title: string;
    description: string;
    variables: string[];
};

const BASE_VARIABLES = [
    "NOME_DO_RESTAURANTE",
    "NOME_DO_CLIENTE",
    "HORARIOS_DE_ABERTURA",
    "LINK_DO_CARDAPIO",
    "PEDIDO_MINIMO",
    "INFORMACOES_DE_ENTREGA",
    "FORMAS_DE_PAGAMENTO",
];

const TEMPLATE_FIELDS: TemplateField[] = [
    {
        key: "welcome",
        title: "Boas-vindas",
        description: "Enviada no início de uma nova conversa.",
        variables: BASE_VARIABLES,
    },
    {
        key: "menu_link",
        title: "Link do cardápio",
        description: "Enviada quando o cliente pede o cardápio.",
        variables: BASE_VARIABLES,
    },
    {
        key: "delivery",
        title: "Entrega e retirada",
        description: "Usa as taxas, prazos e retirada configurados no iMenu.",
        variables: BASE_VARIABLES,
    },
    {
        key: "payment",
        title: "Formas de pagamento",
        description: "Usa os pagamentos habilitados no restaurante.",
        variables: BASE_VARIABLES,
    },
    {
        key: "order_status_found",
        title: "Status do pedido encontrado",
        description: "Enviada quando o robô localiza um pedido recente.",
        variables: [...BASE_VARIABLES, "NUMERO_DO_PEDIDO", "STATUS_DO_PEDIDO"],
    },
    {
        key: "order_status_not_found",
        title: "Pedido não encontrado",
        description: "Enviada quando não há pedido recente para o número.",
        variables: BASE_VARIABLES,
    },
    {
        key: "handoff",
        title: "Atendimento humano",
        description: "Confirma que o robô parou e a equipe assumiu.",
        variables: BASE_VARIABLES,
    },
    {
        key: "unsupported_media",
        title: "Arquivo recebido",
        description: "Enviada ao receber uma imagem, áudio ou arquivo sem texto.",
        variables: BASE_VARIABLES,
    },
    {
        key: "fallback",
        title: "Mensagem não entendida",
        description: "Enviada sem repetir o menu automaticamente.",
        variables: BASE_VARIABLES,
    },
    {
        key: "order_tracking",
        title: "Acompanhamento do pedido",
        description: "Enviada após o cliente compartilhar a comanda iMenu.",
        variables: [...BASE_VARIABLES, "LINK_DE_ACOMPANHAMENTO"],
    },
    {
        key: "status_notification",
        title: "Atualização automática do pedido",
        description: "Enviada quando o status do pedido realmente muda.",
        variables: [...BASE_VARIABLES, "NUMERO_DO_PEDIDO", "STATUS_DO_PEDIDO"],
    },
];

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

function VariablePicker({
    field,
    variables,
    onSelect,
}: {
    field: TemplateField;
    variables: TemplateVariable[];
    onSelect: (variable: TemplateVariable) => void;
}) {
    return (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-xs font-medium text-gray-600">
                Clique em uma variável para inserir na mensagem:
            </p>
            <div className="flex flex-wrap gap-2">
                {variables
                    .filter((variable) => field.variables.includes(variable.key))
                    .map((variable) => (
                        <button
                            key={variable.key}
                            type="button"
                            onClick={() => onSelect(variable)}
                            className="cursor-pointer rounded-full border border-brand/20 bg-white px-3 py-1.5 text-left text-xs text-brand transition-colors hover:bg-brand/5"
                            title={variable.value}
                        >
                            <span className="font-semibold">{variable.label}</span>
                            <span className="ml-1 text-gray-500">
                                ({variable.value})
                            </span>
                        </button>
                    ))}
            </div>
        </div>
    );
}

export default function RoboWhatsAppPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [whatsAppAction, setWhatsAppAction] = useState<
        "connect" | "reconnect" | "refresh_qr" | "disconnect" | null
    >(null);
    const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
    const [connection, setConnection] = useState<WhatsAppConnection | null>(null);
    const [templates, setTemplates] = useState<WhatsAppMessageTemplates | null>(null);
    const [variables, setVariables] = useState<TemplateVariable[]>([]);
    const [conversations, setConversations] = useState<HumanConversation[]>([]);
    const [openTemplate, setOpenTemplate] = useState<WhatsAppTemplateKey | null>(null);
    const [openVariables, setOpenVariables] = useState<WhatsAppTemplateKey | null>(null);
    const [resumingChat, setResumingChat] = useState<string | null>(null);
    const [showToast, setShowToast] = useState(false);
    const [toastConfig, setToastConfig] = useState<{
        message: string;
        type: "success" | "error";
    }>({ message: "", type: "success" });

    const showMessage = (message: string, type: "success" | "error") => {
        setToastConfig({ message, type });
        setShowToast(true);
    };

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
        const loadPage = async () => {
            const session = await getAuthenticatedSession();
            if (!session?.user) {
                setLoading(false);
                return;
            }

            let resolvedRestaurantId = restaurantId;
            if (!resolvedRestaurantId) {
                const { data } = await supabase
                    .from("restaurants")
                    .select("id")
                    .eq("user_id", session.user.id)
                    .single();
                if (!data) {
                    setLoading(false);
                    return;
                }
                resolvedRestaurantId = String(data.id);
                setRestaurantId(resolvedRestaurantId);
            }

            const headers = { Authorization: `Bearer ${session.access_token}` };
            const query = `restaurantId=${encodeURIComponent(resolvedRestaurantId)}`;
            const [connectionResponse, settingsResponse] = await Promise.all([
                fetch(`/api/whatsapp/connection?${query}`, {
                    headers,
                    cache: "no-store",
                }),
                fetch(`/api/whatsapp/settings?${query}`, {
                    headers,
                    cache: "no-store",
                }),
            ]);

            const connectionData = await connectionResponse.json().catch(() => ({}));
            const settingsData = await settingsResponse.json().catch(() => ({}));

            if (connectionResponse.ok) {
                setRestaurant(connectionData.restaurant);
                setConnection(connectionData.connection);
            } else {
                showMessage(
                    connectionData.error || "Não foi possível carregar a conexão do WhatsApp.",
                    "error"
                );
            }

            if (settingsResponse.ok) {
                setTemplates(settingsData.templates);
                setVariables(settingsData.variables || []);
                setConversations(settingsData.conversations || []);
            } else {
                showMessage(
                    settingsData.error || "Não foi possível carregar as mensagens do robô.",
                    "error"
                );
            }

            setLoading(false);
        };

        void loadPage();
    }, [restaurantId, setRestaurantId]);

    useEffect(() => {
        if (!restaurantId) return;
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
                    if (payload.eventType === "DELETE") setConnection(null);
                    else setConnection(payload.new as WhatsAppConnection);
                }
            )
            .subscribe();
        return () => {
            void supabase.removeChannel(channel);
        };
    }, [restaurantId]);

    const runWhatsAppAction = async (
        action: "connect" | "reconnect" | "refresh_qr" | "disconnect"
    ) => {
        if (!restaurantId || whatsAppAction) return;
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

    const saveTemplates = async () => {
        if (!restaurantId || !templates || saving) return;
        const session = await getAuthenticatedSession();
        if (!session) return;
        setSaving(true);
        try {
            const response = await fetch(
                `/api/whatsapp/settings?restaurantId=${encodeURIComponent(restaurantId)}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ templates }),
                }
            );
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Erro ao salvar mensagens.");
            setTemplates(data.templates);
            showMessage("Mensagens salvas com sucesso!", "success");
        } catch (error) {
            showMessage(
                error instanceof Error ? error.message : "Erro ao salvar mensagens.",
                "error"
            );
        } finally {
            setSaving(false);
        }
    };

    const insertVariable = (
        field: TemplateField,
        variable: TemplateVariable,
        refs: MutableRefObject<Record<string, HTMLTextAreaElement | null>>
    ) => {
        if (!templates) return;
        const current = templates[field.key];
        const textarea = refs.current[field.key];
        const start = textarea?.selectionStart ?? current.length;
        const end = textarea?.selectionEnd ?? current.length;
        const next = `${current.slice(0, start)}${variable.token}${current.slice(end)}`;
        setTemplates({ ...templates, [field.key]: next });
        setOpenVariables(null);
        window.requestAnimationFrame(() => {
            const input = refs.current[field.key];
            input?.focus();
            const cursor = start + variable.token.length;
            input?.setSelectionRange(cursor, cursor);
        });
    };

    const resumeBot = async (chatId: string) => {
        if (!restaurantId || resumingChat) return;
        const session = await getAuthenticatedSession();
        if (!session) return;
        setResumingChat(chatId);
        try {
            const response = await fetch(
                `/api/whatsapp/settings?restaurantId=${encodeURIComponent(restaurantId)}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ chatId }),
                }
            );
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Erro ao reativar o robô.");
            setConversations((current) =>
                current.filter((conversation) => conversation.chat_id !== chatId)
            );
            showMessage("Robô reativado nesta conversa.", "success");
        } catch (error) {
            showMessage(
                error instanceof Error ? error.message : "Erro ao reativar o robô.",
                "error"
            );
        } finally {
            setResumingChat(null);
        }
    };

    const status = useMemo(() => connectionPresentation(connection), [connection]);
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
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Robô WhatsApp</h1>
            <p className="mb-6 text-gray-600">
                Conecte o número e personalize as respostas automáticas.
            </p>

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
                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.badge}`}>
                                    {status.label}
                                </span>
                            </div>
                            <p className="mt-1 text-sm text-gray-600">{status.description}</p>
                            {isConnected && (
                                <p className="mt-2 text-sm font-medium text-gray-800">
                                    {connection?.push_name || restaurant?.name}
                                    {connection?.phone ? ` · ${formatPhone(connection.phone)}` : ""}
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
                                connection.status === "STOPPED") && (
                                <Button
                                    onClick={() => runWhatsAppAction("reconnect")}
                                    loading={whatsAppAction === "reconnect"}
                                >
                                    <FontAwesomeIcon icon={faRotate} className="mr-2" />
                                    Tentar reconectar
                                </Button>
                            )}
                            {(connection.status === "FAILED" ||
                                connection.status === "SCAN_QR_CODE" ||
                                connection.status === "PASSKEY_REQUIRED") && (
                                <Button
                                    variant={connection.status === "FAILED" ? "secondary" : undefined}
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
                                        <li>Toque no menu <b>⋮</b> no Android ou em <b>Configurações</b> no iPhone.</li>
                                        <li>Toque em <b>Aparelhos conectados</b>.</li>
                                        <li>Toque em <b>Conectar um aparelho</b>.</li>
                                        <li>Aponte a câmera para este QR Code.</li>
                                    </ol>
                                    <p className="mt-4 text-xs text-gray-500">
                                        O código muda automaticamente quando expira. Esta tela é atualizada em tempo real, sem precisar recarregar a página.
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                {connection?.status === "PASSKEY_CONFIRMATION_REQUIRED" && (
                    <Card className="border border-blue-200 bg-blue-50 p-6">
                        <p className="font-semibold text-gray-900">Confirme o código no celular</p>
                        <p className="mt-2 text-sm text-gray-700">
                            Confira se o código exibido pelo WhatsApp é
                            <b> {connection.status_data?.code || "o mesmo mostrado no aparelho"}</b> e confirme no celular.
                        </p>
                    </Card>
                )}

                {templates && (
                    <Card className="border border-gray-200 p-7">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Mensagens automáticas
                                </h3>
                                <p className="mt-1 text-sm text-gray-600">
                                    Personalize o texto. As variáveis usam os dados atuais do restaurante e do pedido.
                                </p>
                            </div>
                            <Button onClick={saveTemplates} loading={saving}>
                                Salvar mensagens
                            </Button>
                        </div>

                        <div className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200">
                            {TEMPLATE_FIELDS.map((field) => {
                                const isOpen = openTemplate === field.key;
                                return (
                                    <div key={field.key}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOpenTemplate(isOpen ? null : field.key);
                                                setOpenVariables(null);
                                            }}
                                            className="flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-4 text-left"
                                            aria-expanded={isOpen}
                                        >
                                            <span>
                                                <span className="block text-sm font-semibold text-gray-900">
                                                    {field.title}
                                                </span>
                                                <span className="mt-0.5 block text-xs text-gray-500">
                                                    {field.description}
                                                </span>
                                            </span>
                                            <FontAwesomeIcon
                                                icon={faChevronDown}
                                                className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                                            />
                                        </button>

                                        {isOpen && (
                                            <div className="border-t border-gray-100 px-4 pb-5 pt-4">
                                                <textarea
                                                    ref={(element) => {
                                                        textareaRefs.current[field.key] = element;
                                                    }}
                                                    value={templates[field.key]}
                                                    aria-label={`Mensagem: ${field.title}`}
                                                    onChange={(event) =>
                                                        setTemplates({
                                                            ...templates,
                                                            [field.key]: event.target.value,
                                                        })
                                                    }
                                                    rows={6}
                                                    maxLength={4000}
                                                    className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setOpenVariables(
                                                            openVariables === field.key ? null : field.key
                                                        )
                                                    }
                                                    className="mt-3 cursor-pointer rounded-md border border-brand/20 px-3 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand/5"
                                                >
                                                    <FontAwesomeIcon icon={faPlus} className="mr-2" />
                                                    Adicionar variável
                                                </button>
                                                {openVariables === field.key && (
                                                    <VariablePicker
                                                        field={field}
                                                        variables={variables}
                                                        onSelect={(variable) =>
                                                            insertVariable(field, variable, textareaRefs)
                                                        }
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                )}

                {conversations.length > 0 && (
                    <Card className="border border-gray-200 p-7">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Atendimentos humanos
                        </h3>
                        <p className="mt-1 text-sm text-gray-600">
                            O robô não responde nestas conversas até você reativá-lo.
                        </p>
                        <div className="mt-5 divide-y divide-gray-200 rounded-lg border border-gray-200">
                            {conversations.map((conversation) => (
                                <div
                                    key={conversation.chat_id}
                                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">
                                            {conversation.customer_name?.trim() || "Cliente"}
                                        </p>
                                        <p className="mt-0.5 text-xs text-gray-500">
                                            {formatPhone(conversation.chat_id.split("@")[0])}
                                        </p>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        onClick={() => resumeBot(conversation.chat_id)}
                                        loading={resumingChat === conversation.chat_id}
                                    >
                                        Reativar robô
                                    </Button>
                                </div>
                            ))}
                        </div>
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
                            <div key={feature.title} className="flex gap-3 rounded-lg border border-gray-200 p-4">
                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                                    <FontAwesomeIcon icon={feature.icon} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{feature.title}</p>
                                    <p className="mt-1 text-sm text-gray-600">{feature.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

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
