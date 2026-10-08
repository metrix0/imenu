"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    faCircleCheck,
    faPowerOff,
    faQrcode,
    faRotate,
    faRobot,
    faUser,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import Loader from "@/components/ui/Loader";
import Switch from "@/components/ui/Switch";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import Textarea from "@/components/ui/Textarea";
import { supabase } from "@/lib/database/supabaseClient";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";
const BULK_SEND_MIN_DELAY_SECONDS = 15;
const BULK_SEND_MAX_DELAY_SECONDS = 30;

type BulkInputRecipient = {
    phone: string;
    values: Record<string, string>;
};

function splitMarkdownTableRow(line: string): string[] {
    let row = line.trim();
    if (row.startsWith("|")) row = row.slice(1);
    if (row.endsWith("|")) row = row.slice(0, -1);

    const cells: string[] = [];
    let current = "";

    for (let index = 0; index < row.length; index += 1) {
        if (row[index] === "\\" && row[index + 1] === "|") {
            current += "|";
            index += 1;
            continue;
        }
        if (row[index] === "|") {
            cells.push(current.trim());
            current = "";
            continue;
        }
        current += row[index];
    }

    cells.push(current.trim());
    return cells;
}

function normalizeBulkHeader(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function cleanBulkValue(value: string): string {
    return value
        .trim()
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/`([^`]*)`/g, "$1")
        .trim();
}

function parseBulkRecipients(value: string): BulkInputRecipient[] {
    const lines = value.split(/\r?\n/).filter((line) => line.trim());
    const separatorIndex = lines.findIndex((line, index) => {
        if (index === 0) return false;
        const cells = splitMarkdownTableRow(line);
        return (
            cells.length > 0 &&
            cells.every((cell) =>
                /^:?-{3,}:?$/.test(cell.replace(/\s/g, ""))
            )
        );
    });

    if (separatorIndex > 0) {
        const headers = splitMarkdownTableRow(lines[separatorIndex - 1]).map(
            cleanBulkValue
        );
        const phoneIndex = headers.findIndex((header) => {
            const normalized = normalizeBulkHeader(header);
            return (
                normalized.includes("whatsapp") ||
                normalized.includes("telefone") ||
                normalized === "phone" ||
                normalized === "numero" ||
                normalized === "number"
            );
        });

        if (phoneIndex >= 0) {
            const seen = new Set<string>();
            const recipients: BulkInputRecipient[] = [];

            for (const line of lines.slice(separatorIndex + 1)) {
                if (!line.includes("|")) continue;
                const cells = splitMarkdownTableRow(line);
                const phone = cleanBulkValue(cells[phoneIndex] || "");
                const digits = phone.replace(/\D/g, "");
                if (!digits || seen.has(digits)) continue;
                seen.add(digits);

                recipients.push({
                    phone,
                    values: Object.fromEntries(
                        headers.map((header, index) => [
                            header,
                            cleanBulkValue(cells[index] || ""),
                        ])
                    ),
                });
            }

            return recipients;
        }
    }

    const seen = new Set<string>();
    return value
        .split(/\r?\n|[,;]/)
        .map((phone) => phone.trim())
        .filter((phone) => {
            const digits = phone.replace(/\D/g, "");
            if (!digits || seen.has(digits)) return false;
            seen.add(digits);
            return true;
        })
        .map((phone) => ({ phone, values: {} }));
}

function parseBulkPhones(value: string): string[] {
    return parseBulkRecipients(value).map((recipient) => recipient.phone);
}

function renderBulkMessage(
    template: string,
    values: Record<string, string>
): string {
    const normalizedValues = new Map(
        Object.entries(values).map(([key, value]) => [
            normalizeBulkHeader(key),
            value.trim(),
        ])
    );

    return template.replace(
        /\{\{\s*([^{}|]+?)\s*(?:\|\|\s*([^{}]*?)\s*)?\}\}/g,
        (_match, key: string, fallback = "") => {
            const value =
                normalizedValues.get(normalizeBulkHeader(key)) || "";
            if (value && value !== "—" && value !== "-") return value;

            const fallbackValue = fallback.trim();
            if (!fallbackValue) return "";

            const quoted = fallbackValue.match(/^(["'])([\s\S]*)\1$/);
            if (quoted) return quoted[2];

            const variable =
                normalizedValues.get(normalizeBulkHeader(fallbackValue)) || "";
            return variable === "—" || variable === "-" ? "" : variable;
        }
    );
}

type AccessState = "checking" | "allowed" | "forbidden" | "signed-out";

type BulkRecipientStatus =
    | "pending"
    | "sending"
    | "sent"
    | "skipped_recent"
    | "failed";

type BulkRecipientResult = {
    phone: string;
    status: BulkRecipientStatus;
    error?: string;
};

type Connection = {
    session_name: string;
    desired_state: "connected" | "disconnected";
    status: string;
    phone: string | null;
    push_name: string | null;
    qr_code_data: string | null;
    last_connected_at: string | null;
    last_error: string | null;
    bot_enabled: boolean;
};

type Stats = {
    conversations_today: number;
    ai_replies_today: number;
    human_conversations: number;
    knowledge_entries: number;
};

type KnowledgeEntry = {
    id: string;
    title: string;
    content: string;
    enabled: boolean;
    updated_at: string;
};

type Conversation = {
    id: string;
    phone: string | null;
    customer_name: string | null;
    restaurant_id: string | null;
    restaurant_name: string | null;
    mode: "ai" | "human";
    updated_at: string;
    human_started_at?: string | null;
    last_human_reply_at?: string | null;
    last_message: string | null;
};

type DashboardData = {
    connection: Connection;
    blastConnection: Connection;
    stats: Stats;
    knowledge: KnowledgeEntry[];
    conversations: Conversation[];
    handedOff: Conversation[];
};

function formatPhone(value: string | null): string {
    const digits = String(value || "").replace(/\D/g, "");
    const local = digits.startsWith("55") ? digits.slice(2) : digits;

    if (local.length === 11) {
        return (
            "(" +
            local.slice(0, 2) +
            ") " +
            local.slice(2, 7) +
            "-" +
            local.slice(7)
        );
    }

    if (local.length === 10) {
        return (
            "(" +
            local.slice(0, 2) +
            ") " +
            local.slice(2, 6) +
            "-" +
            local.slice(6)
        );
    }

    return value || "—";
}

function getWhatsappUrl(value: string | null): string | null {
    let digits = String(value || "").replace(/\D/g, "");
    if (!digits) return null;
    if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
        digits = "55" + digits;
    }
    return "https://wa.me/" + digits;
}

function statusPresentation(connection: Connection | null) {
    if (!connection || connection.desired_state === "disconnected") {
        return {
            label: "Não conectado",
            className: "bg-gray-100 text-gray-600",
        };
    }

    if (connection.status === "WORKING") {
        return {
            label: "Conectado",
            className: "bg-green-50 text-green-700",
        };
    }

    if (connection.status === "SCAN_QR_CODE") {
        return {
            label: "Escaneie o QR",
            className: "bg-blue-50 text-blue-700",
        };
    }

    if (connection.status === "FAILED") {
        return {
            label: "Falhou",
            className: "bg-red-50 text-red-700",
        };
    }

    return {
        label: "Conectando",
        className: "bg-amber-50 text-amber-700",
    };
}

export default function DevSupportPage() {
    const router = useRouter();
    const [accessState, setAccessState] =
        useState<AccessState>("checking");
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [action, setAction] = useState("");
    const [error, setError] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [knowledgeEditorOpen, setKnowledgeEditorOpen] = useState(false);
    const [knowledgeTitle, setKnowledgeTitle] = useState("");
    const [knowledgeContent, setKnowledgeContent] = useState("");
    const [bulkPhones, setBulkPhones] = useState("");
    const [bulkMessage, setBulkMessage] = useState("");
    const [bulkSending, setBulkSending] = useState(false);
    const [bulkSent, setBulkSent] = useState(0);
    const [bulkTotal, setBulkTotal] = useState(0);
    const [bulkStatus, setBulkStatus] = useState("");
    const [bulkSkipRecent, setBulkSkipRecent] = useState(true);
    const [bulkSender, setBulkSender] = useState<"blast" | "support">("blast");
    const [bulkRecipients, setBulkRecipients] = useState<BulkRecipientResult[]>([]);
    const [bulkFailures, setBulkFailures] = useState<
        Array<{ phone: string; error: string }>
    >([]);
    const bulkStopRef = useRef(false);

    const getAccessToken = useCallback(async () => {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        return session?.access_token || null;
    }, []);

    const loadDashboard = useCallback(async () => {
        const token = await getAccessToken();
        if (!token) {
            setAccessState("signed-out");
            setLoading(false);
            return;
        }

        const response = await fetch("/api/dev/support", {
            headers: { Authorization: "Bearer " + token },
            cache: "no-store",
        });
        const payload = (await response.json()) as DashboardData & {
            error?: string;
        };

        if (response.status === 401) {
            setAccessState("signed-out");
            setLoading(false);
            return;
        }
        if (response.status === 403) {
            setAccessState("forbidden");
            setLoading(false);
            return;
        }
        if (!response.ok) {
            throw new Error(payload.error || "Erro ao carregar suporte.");
        }

        setData(payload);
        setError("");
        setLoading(false);
    }, [getAccessToken]);

    useEffect(() => {
        let active = true;

        const checkAccess = async () => {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (!active) return;
            if (userError || !user) {
                setAccessState("signed-out");
                setLoading(false);
                return;
            }
            if (
                user.email?.trim().toLowerCase() !== ALLOWED_DEV_EMAIL
            ) {
                setAccessState("forbidden");
                setLoading(false);
                return;
            }

            setAccessState("allowed");
            try {
                await loadDashboard();
            } catch (caught) {
                if (!active) return;
                setError(
                    caught instanceof Error
                        ? caught.message
                        : "Erro ao carregar suporte."
                );
                setLoading(false);
            }
        };

        void checkAccess();
        return () => {
            active = false;
        };
    }, [loadDashboard]);

    useEffect(() => {
        const connections = [data?.connection, data?.blastConnection];
        const hasConnectingSession = connections.some(
            (connection) =>
                connection?.desired_state === "connected" &&
                connection.status !== "WORKING"
        );

        if (accessState !== "allowed" || !hasConnectingSession) return;

        const timer = window.setInterval(() => {
            void loadDashboard().catch(() => undefined);
        }, 4000);

        return () => window.clearInterval(timer);
    }, [accessState, data?.connection, data?.blastConnection, loadDashboard]);

    useEffect(() => {
        if (accessState !== "allowed" || !data?.handedOff.length) return;

        const timer = window.setInterval(() => {
            void loadDashboard().catch(() => undefined);
        }, 60_000);

        return () => window.clearInterval(timer);
    }, [accessState, data?.handedOff.length, loadDashboard]);

    const runAction = async (
        nextAction: string,
        extra: Record<string, unknown> = {}
    ) => {
        const actionKey =
            typeof extra.connection === "string"
                ? nextAction + ":" + extra.connection
                : nextAction;
        setAction(actionKey);
        setError("");

        try {
            const token = await getAccessToken();
            if (!token) {
                setAccessState("signed-out");
                return;
            }

            const response = await fetch("/api/dev/support", {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ action: nextAction, ...extra }),
            });
            const payload = (await response.json()) as DashboardData & {
                error?: string;
            };

            if (!response.ok) {
                throw new Error(payload.error || "Ação falhou.");
            }

            setData(payload);
        } catch (caught) {
            setError(
                caught instanceof Error ? caught.message : "Ação falhou."
            );
        } finally {
            setAction("");
        }
    };

    const startBulkSend = async () => {
        const recipients = parseBulkRecipients(bulkPhones);
        const messageTemplate = bulkMessage.trim();

        if (!recipients.length || !messageTemplate) {
            setBulkStatus("Informe pelo menos um número e uma mensagem.");
            return;
        }

        window.alert("Deixe em janela aberta");

        const token = await getAccessToken();
        if (!token) {
            setAccessState("signed-out");
            return;
        }

        const batchId = crypto.randomUUID();
        const skippedErrors: string[] = [];
        let sentCount = 0;
        bulkStopRef.current = false;
        setBulkSending(true);
        setBulkSent(0);
        setBulkTotal(recipients.length);
        setBulkStatus("");
        setBulkPhones("");
        setBulkFailures([]);
        setBulkRecipients(
            recipients.map(({ phone }) => ({
                phone,
                status: "pending",
            }))
        );

        try {
            for (let index = 0; index < recipients.length; index += 1) {
                if (bulkStopRef.current) break;

                const recipient = recipients[index];
                const phone = recipient.phone;
                const message = renderBulkMessage(
                    messageTemplate,
                    recipient.values
                ).trim();
                setBulkRecipients((current) =>
                    current.map((recipient) =>
                        recipient.phone === phone
                            ? { ...recipient, status: "sending", error: undefined }
                            : recipient
                    )
                );
                setBulkStatus(
                    "Enviando " + (index + 1) + " de " + recipients.length + "..."
                );

                const response = await fetch("/api/dev/support", {
                    method: "POST",
                    headers: {
                        Authorization: "Bearer " + token,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        action: "send_bulk_message",
                        batchId,
                        phone,
                        message,
                        skipRecent: bulkSkipRecent,
                        sender: bulkSender,
                    }),
                });
                const payload = (await response.json()) as {
                    error?: string;
                    skippedRecent?: boolean;
                };

                if (!response.ok) {
                    const error = payload.error || "Falha ao enviar.";
                    const errorMessage = phone + ": " + error;

                    skippedErrors.push(errorMessage);
                    setBulkRecipients((current) =>
                        current.map((recipient) =>
                            recipient.phone === phone
                                ? {
                                      ...recipient,
                                      status: "failed",
                                      error,
                                  }
                                : recipient
                        )
                    );
                    setBulkFailures((current) => [
                        ...current,
                        { phone, error },
                    ]);
                    setBulkStatus("Ignorado: " + errorMessage);
                    continue;
                }

                if (payload.skippedRecent) {
                    setBulkRecipients((current) =>
                        current.map((recipient) =>
                            recipient.phone === phone
                                ? { ...recipient, status: "skipped_recent" }
                                : recipient
                        )
                    );
                    setBulkStatus(
                        "Ignorado: " +
                            phone +
                            " já recebeu envio em massa nos últimos 7 dias."
                    );
                    continue;
                }

                sentCount += 1;
                setBulkSent(sentCount);
                setBulkRecipients((current) =>
                    current.map((recipient) =>
                        recipient.phone === phone
                            ? { ...recipient, status: "sent" }
                            : recipient
                    )
                );

                if (index < recipients.length - 1 && !bulkStopRef.current) {
                    const delaySeconds =
                        Math.floor(
                            Math.random() *
                                (BULK_SEND_MAX_DELAY_SECONDS -
                                    BULK_SEND_MIN_DELAY_SECONDS +
                                    1)
                        ) + BULK_SEND_MIN_DELAY_SECONDS;

                    setBulkStatus(
                        "Enviado " +
                            sentCount +
                            " de " +
                            recipients.length +
                            ". Próximo envio em " +
                            delaySeconds +
                            "s..."
                    );

                    for (
                        let waited = 0;
                        waited < delaySeconds && !bulkStopRef.current;
                        waited += 1
                    ) {
                        await new Promise((resolve) =>
                            window.setTimeout(resolve, 1000)
                        );
                    }
                }
            }

            const skippedSuffix = skippedErrors.length
                ? " Erros: " + skippedErrors.join(" | ")
                : "";
            setBulkStatus(
                (bulkStopRef.current
                    ? "Envio interrompido."
                    : "Envio concluído.") + skippedSuffix
            );
        } catch (caught) {
            setBulkStatus(
                "Envio pausado por erro: " +
                    (caught instanceof Error
                        ? caught.message
                        : "Falha desconhecida.")
            );
        } finally {
            setBulkSending(false);
        }
    };

    const startEditing = (entry?: KnowledgeEntry) => {
        setEditingId(entry?.id || null);
        setKnowledgeTitle(entry?.title || "");
        setKnowledgeContent(entry?.content || "");
        setKnowledgeEditorOpen(true);
    };

    const saveKnowledge = async () => {
        await runAction("save_knowledge", {
            id: editingId,
            title: knowledgeTitle,
            content: knowledgeContent,
        });
        setEditingId(null);
        setKnowledgeTitle("");
        setKnowledgeContent("");
        setKnowledgeEditorOpen(false);
    };

    if (accessState === "checking" || loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-50">
                <Loader />
            </main>
        );
    }

    if (accessState === "signed-out") {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
                <Card className="w-full max-w-md text-center">
                    <h1 className="text-xl font-semibold">Faça login primeiro</h1>
                    <p className="mt-2 text-sm text-gray-500">
                        Entre com {ALLOWED_DEV_EMAIL}.
                    </p>
                    <Button
                        className="mt-5"
                        onClick={() => router.push("/restaurante/login")}
                    >
                        Ir para o login
                    </Button>
                </Card>
            </main>
        );
    }

    if (accessState === "forbidden") {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
                <Card className="w-full max-w-md text-center">
                    <h1 className="text-xl font-semibold text-red-700">
                        Acesso negado
                    </h1>
                </Card>
            </main>
        );
    }

    const connection = data?.connection || null;
    const blastConnection = data?.blastConnection || null;
    const status = statusPresentation(connection);
    const blastStatus = statusPresentation(blastConnection);
    const showQr =
        connection?.desired_state === "connected" &&
        connection.status === "SCAN_QR_CODE";
    const showBlastQr =
        blastConnection?.desired_state === "connected" &&
        blastConnection.status === "SCAN_QR_CODE";
    const selectedBulkConnection =
        bulkSender === "blast" ? blastConnection : connection;

    return (
        <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
            <div className="mx-auto max-w-6xl space-y-6">
                <header>
                    <p className="text-sm font-medium text-brand">/dev/support</p>
                    <h1 className="mt-1 text-3xl font-bold text-gray-900">
                        Suporte iMenu
                    </h1>
                    <p className="mt-2 text-sm text-gray-600">
                        WhatsApp, IA, base de conhecimento e conversas em um só lugar.
                    </p>
                </header>

                {error && (
                    <Card className="border-red-200 bg-red-50">
                        <p className="text-sm text-red-700">{error}</p>
                    </Card>
                )}

                <Card>
                    <h2 className="text-lg font-semibold text-gray-900">
                        Handed Off
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Conversas atualmente sob atendimento humano.
                    </p>

                    <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200">
                        {data?.handedOff.length ? (
                            <table className="w-full min-w-[620px] text-left text-sm">
                                <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">
                                            Restaurante
                                        </th>
                                        <th className="px-4 py-3 font-semibold">
                                            Contato
                                        </th>
                                        <th className="px-4 py-3 text-right font-semibold">
                                            Ação
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {data.handedOff.map((conversation) => {
                                        const whatsappUrl = getWhatsappUrl(
                                            conversation.phone
                                        );

                                        return (
                                            <tr key={conversation.id}>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-gray-900">
                                                        {conversation.restaurant_name ||
                                                            "Restaurante não identificado"}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">
                                                    {conversation.customer_name
                                                        ? conversation.customer_name + " · "
                                                        : ""}
                                                    {formatPhone(conversation.phone)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button
                                                        variant="secondary"
                                                        disabled={!whatsappUrl}
                                                        onClick={() => {
                                                            if (!whatsappUrl) return;
                                                            window.open(
                                                                whatsappUrl,
                                                                "_blank",
                                                                "noopener,noreferrer"
                                                            );
                                                        }}
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={faWhatsapp}
                                                            className="mr-2"
                                                        />
                                                        Abrir WhatsApp
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <p className="p-6 text-center text-sm text-gray-500">
                                Nenhuma conversa em atendimento humano.
                            </p>
                        )}
                    </div>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        ["Conversas hoje", data?.stats.conversations_today ?? 0],
                        ["Respostas IA hoje", data?.stats.ai_replies_today ?? 0],
                        ["Em atendimento humano", data?.stats.human_conversations ?? 0],
                        ["Itens de conhecimento", data?.stats.knowledge_entries ?? 0],
                    ].map(([label, value]) => (
                        <Card key={String(label)}>
                            <p className="text-sm text-gray-500">{label}</p>
                            <p className="mt-2 text-3xl font-medium tabular-nums text-gray-900">
                                {value}
                            </p>
                        </Card>
                    ))}
                </div>

                <Card>
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-xl text-green-600">
                                <FontAwesomeIcon icon={faWhatsapp} />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        WhatsApp do suporte
                                    </h2>
                                    <span
                                        className={
                                            "rounded-full px-2.5 py-1 text-xs font-medium " +
                                            status.className
                                        }
                                    >
                                        {status.label}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm text-gray-500">
                                    Sessão: {connection?.session_name || "imenu-support"}
                                </p>
                                {connection?.phone && (
                                    <p className="mt-1 text-sm font-medium text-gray-800">
                                        {connection.push_name || "Suporte iMenu"} ·{" "}
                                        {formatPhone(connection.phone)}
                                    </p>
                                )}
                                {connection?.last_error && (
                                    <p className="mt-2 text-sm text-red-600">
                                        {connection.last_error}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {!connection ||
                            connection.desired_state === "disconnected" ? (
                                <Button
                                    onClick={() =>
                                        void runAction("connect", {
                                            connection: "support",
                                        })
                                    }
                                    loading={action === "connect:support"}
                                >
                                    <FontAwesomeIcon
                                        icon={faQrcode}
                                        className="mr-2"
                                    />
                                    Conectar WhatsApp
                                </Button>
                            ) : (
                                <>
                                    {connection.status !== "WORKING" && (
                                        <Button
                                            onClick={() =>
                                                void runAction("reconnect", {
                                                    connection: "support",
                                                })
                                            }
                                            loading={action === "reconnect:support"}
                                        >
                                            <FontAwesomeIcon
                                                icon={faRotate}
                                                className="mr-2"
                                            />
                                            Reconectar
                                        </Button>
                                    )}
                                    {connection.status !== "WORKING" && (
                                        <Button
                                            variant="secondary"
                                            onClick={() =>
                                                void runAction("refresh_qr", {
                                                    connection: "support",
                                                })
                                            }
                                            loading={action === "refresh_qr:support"}
                                        >
                                            Novo QR
                                        </Button>
                                    )}
                                    <Button
                                        variant="secondary"
                                        onClick={() =>
                                            void runAction("disconnect", {
                                                connection: "support",
                                            })
                                        }
                                        loading={action === "disconnect:support"}
                                    >
                                        <FontAwesomeIcon
                                            icon={faPowerOff}
                                            className="mr-2"
                                        />
                                        Desconectar
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {showQr && (
                        <div className="mt-6 grid gap-5 rounded-xl border border-blue-100 bg-blue-50/40 p-5 sm:grid-cols-[220px_1fr] sm:items-center">
                            <div className="flex min-h-[210px] items-center justify-center rounded-xl border border-gray-200 bg-white p-3">
                                {connection?.qr_code_data ? (
                                    <img
                                        src={connection.qr_code_data}
                                        alt="QR Code do WhatsApp de suporte"
                                        className="h-48 w-48"
                                    />
                                ) : (
                                    <p className="text-sm text-gray-500">
                                        Preparando QR…
                                    </p>
                                )}
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">
                                    Escaneie com o número do suporte iMenu
                                </h3>
                                <p className="mt-2 text-sm text-gray-600">
                                    WhatsApp → Aparelhos conectados → Conectar um aparelho.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex items-center justify-between rounded-xl border border-gray-200 p-4">
                        <div>
                            <p className="font-medium text-gray-900">
                                Respostas por IA
                            </p>
                            <p className="text-sm text-gray-500">
                                Notificações automáticas continuam indo direto pelo WAHA.
                            </p>
                        </div>
                        <Button
                            variant={connection?.bot_enabled ? "secondary" : "primary"}
                            onClick={() =>
                                void runAction("set_bot_enabled", {
                                    enabled: !connection?.bot_enabled,
                                })
                            }
                            loading={action === "set_bot_enabled"}
                        >
                            <FontAwesomeIcon
                                icon={connection?.bot_enabled ? faCircleCheck : faRobot}
                                className="mr-2"
                            />
                            {connection?.bot_enabled ? "IA ativa" : "Ativar IA"}
                        </Button>
                    </div>
                </Card>

                <Card>
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-xl text-green-600">
                                <FontAwesomeIcon icon={faWhatsapp} />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        WhatsApp Blast
                                    </h2>
                                    <span
                                        className={
                                            "rounded-full px-2.5 py-1 text-xs font-medium " +
                                            blastStatus.className
                                        }
                                    >
                                        {blastStatus.label}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm text-gray-500">
                                    Sessão: {blastConnection?.session_name || "imenu-blast"}
                                </p>
                                {blastConnection?.phone && (
                                    <p className="mt-1 text-sm font-medium text-gray-800">
                                        {blastConnection.push_name || "Blast iMenu"} ·{" "}
                                        {formatPhone(blastConnection.phone)}
                                    </p>
                                )}
                                {blastConnection?.last_error && (
                                    <p className="mt-2 text-sm text-red-600">
                                        {blastConnection.last_error}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {!blastConnection ||
                            blastConnection.desired_state === "disconnected" ? (
                                <Button
                                    onClick={() =>
                                        void runAction("connect", {
                                            connection: "blast",
                                        })
                                    }
                                    loading={action === "connect:blast"}
                                >
                                    <FontAwesomeIcon
                                        icon={faQrcode}
                                        className="mr-2"
                                    />
                                    Conectar WhatsApp
                                </Button>
                            ) : (
                                <>
                                    {blastConnection.status !== "WORKING" && (
                                        <Button
                                            onClick={() =>
                                                void runAction("reconnect", {
                                                    connection: "blast",
                                                })
                                            }
                                            loading={action === "reconnect:blast"}
                                        >
                                            <FontAwesomeIcon
                                                icon={faRotate}
                                                className="mr-2"
                                            />
                                            Reconectar
                                        </Button>
                                    )}
                                    {blastConnection.status !== "WORKING" && (
                                        <Button
                                            variant="secondary"
                                            onClick={() =>
                                                void runAction("refresh_qr", {
                                                    connection: "blast",
                                                })
                                            }
                                            loading={action === "refresh_qr:blast"}
                                        >
                                            Novo QR
                                        </Button>
                                    )}
                                    <Button
                                        variant="secondary"
                                        onClick={() =>
                                            void runAction("disconnect", {
                                                connection: "blast",
                                            })
                                        }
                                        loading={action === "disconnect:blast"}
                                    >
                                        <FontAwesomeIcon
                                            icon={faPowerOff}
                                            className="mr-2"
                                        />
                                        Desconectar
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4">
                        <div>
                            <p className="font-medium text-gray-900">
                                Respostas por IA
                            </p>
                            <p className="text-sm text-gray-500">
                                Responde automaticamente pessoas que receberam disparos por este número.
                            </p>
                        </div>
                        <Switch
                            checked={blastConnection?.bot_enabled ?? true}
                            disabled={action === "set_bot_enabled:blast"}
                            aria-label="Ativar respostas por IA no WhatsApp Blast"
                            onClick={() =>
                                void runAction("set_bot_enabled", {
                                    connection: "blast",
                                    enabled: !(blastConnection?.bot_enabled ?? true),
                                })
                            }
                        />
                    </div>

                    {showBlastQr && (
                        <div className="mt-6 grid gap-5 rounded-xl border border-blue-100 bg-blue-50/40 p-5 sm:grid-cols-[220px_1fr] sm:items-center">
                            <div className="flex min-h-[210px] items-center justify-center rounded-xl border border-gray-200 bg-white p-3">
                                {blastConnection?.qr_code_data ? (
                                    <img
                                        src={blastConnection.qr_code_data}
                                        alt="QR Code do WhatsApp Blast"
                                        className="h-48 w-48"
                                    />
                                ) : (
                                    <p className="text-sm text-gray-500">
                                        Preparando QR…
                                    </p>
                                )}
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">
                                    Escaneie com o número secundário
                                </h3>
                                <p className="mt-2 text-sm text-gray-600">
                                    WhatsApp → Aparelhos conectados → Conectar um aparelho.
                                </p>
                            </div>
                        </div>
                    )}
                </Card>

                <Card>
                    <h2 className="text-lg font-semibold text-gray-900">
                        Envio em massa
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Envia uma mensagem por vez pelo número selecionado, com intervalo aleatório entre 15 e 30 segundos.
                    </p>

                    <div className="mt-5 max-w-md">
                        <Dropdown
                            custom
                            label="Número de envio"
                            value={bulkSender}
                            onChange={(event) =>
                                setBulkSender(
                                    event.target.value as "blast" | "support"
                                )
                            }
                            disabled={bulkSending}
                            options={[
                                {
                                    value: "blast",
                                    label:
                                        "WhatsApp Blast" +
                                        (blastConnection?.phone
                                            ? " · " + formatPhone(blastConnection.phone)
                                            : " · não conectado"),
                                },
                                {
                                    value: "support",
                                    label:
                                        "WhatsApp do suporte" +
                                        (connection?.phone
                                            ? " · " + formatPhone(connection.phone)
                                            : " · não conectado"),
                                },
                            ]}
                        />
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-gray-800">
                                Números
                            </label>
                            <Textarea
                                value={bulkPhones}
                                onChange={(event) =>
                                    setBulkPhones(event.target.value)
                                }
                                rows={6}
                                disabled={bulkSending}
                                placeholder={"19 99999-9999\n19 98888-8888"}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Um número por linha ou tabela Markdown com coluna WhatsApp/Telefone. {parseBulkPhones(bulkPhones).length} destinatário(s).
                            </p>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-gray-800">
                                Mensagem
                            </label>
                            <Textarea
                                value={bulkMessage}
                                onChange={(event) =>
                                    setBulkMessage(event.target.value)
                                }
                                rows={6}
                                disabled={bulkSending}
                                placeholder="Digite a mensagem..."
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Use colunas da tabela como {"{{Restaurant Name}}"}. Fallback literal: {'{{Restaurant Name||"pessoal"}}'}. Sem aspas, o fallback é outra coluna.
                            </p>
                        </div>
                    </div>

                    <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={bulkSkipRecent}
                            onChange={(event) =>
                                setBulkSkipRecent(event.target.checked)
                            }
                            disabled={bulkSending}
                            className="h-4 w-4 cursor-pointer accent-brand disabled:cursor-not-allowed"
                        />
                        <span>
                            Não repetir números que já receberam envio em massa nos últimos 7 dias
                        </span>
                    </label>

                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        <p>
                            <strong>Atenção:</strong> não é recomendado enviar para mais de 50 destinatários por lote.
                        </p>
                        <p className="mt-1">
                            Mantenha esta janela aberta durante todo o envio. Fechar ou recarregar a página interrompe o lote.
                        </p>
                        {parseBulkPhones(bulkPhones).length > 50 && (
                            <p className="mt-1 font-semibold">
                                Este lote tem mais de 50 destinatários.
                            </p>
                        )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Button
                            onClick={() => void startBulkSend()}
                            disabled={
                                bulkSending ||
                                !bulkMessage.trim() ||
                                !parseBulkPhones(bulkPhones).length ||
                                selectedBulkConnection?.status !== "WORKING"
                            }
                        >
                            Enviar em massa
                        </Button>
                        {bulkSending && (
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    bulkStopRef.current = true;
                                    setBulkStatus("Interrompendo após o envio atual...");
                                }}
                            >
                                Parar
                            </Button>
                        )}
                        {bulkTotal > 0 && (
                            <span className="text-sm text-gray-500">
                                {bulkSent} / {bulkTotal} enviados
                            </span>
                        )}
                    </div>

                    {bulkStatus && (
                        <p className="mt-3 text-sm text-gray-600">
                            {bulkStatus}
                        </p>
                    )}

                    {bulkRecipients.length > 0 && (
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-sm font-semibold text-gray-900">
                                        Números do lote
                                    </h3>
                                    <span className="text-xs text-gray-500">
                                        {bulkRecipients.length}
                                    </span>
                                </div>
                                <div className="mt-3 max-h-64 divide-y divide-gray-200 overflow-y-auto">
                                    {bulkRecipients.map((recipient) => (
                                        <div
                                            key={recipient.phone}
                                            className="flex items-center justify-between gap-3 py-2 text-sm"
                                        >
                                            <span className="text-gray-700">
                                                {formatPhone(recipient.phone)}
                                            </span>
                                            <span
                                                className={
                                                    recipient.status === "sent"
                                                        ? "text-green-700"
                                                        : recipient.status === "failed"
                                                          ? "text-red-700"
                                                          : recipient.status ===
                                                              "sending"
                                                            ? "text-amber-700"
                                                            : "text-gray-500"
                                                }
                                            >
                                                {recipient.status === "sent"
                                                    ? "Enviado"
                                                    : recipient.status === "failed"
                                                      ? "Falhou"
                                                      : recipient.status ===
                                                          "skipped_recent"
                                                        ? "Ignorado (7 dias)"
                                                        : recipient.status ===
                                                            "sending"
                                                          ? "Enviando"
                                                          : "Pendente"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-sm font-semibold text-red-900">
                                        Falhas
                                    </h3>
                                    <span className="text-xs text-red-700">
                                        {bulkFailures.length}
                                    </span>
                                </div>
                                {bulkFailures.length ? (
                                    <div className="mt-3 max-h-64 divide-y divide-red-100 overflow-y-auto">
                                        {bulkFailures.map((failure, index) => (
                                            <div
                                                key={failure.phone + ":" + index}
                                                className="py-2 text-sm"
                                            >
                                                <p className="font-medium text-red-900">
                                                    {formatPhone(failure.phone)}
                                                </p>
                                                <p className="mt-0.5 text-xs text-red-700">
                                                    {failure.error}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-3 text-sm text-red-700/70">
                                        Nenhuma falha neste lote.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </Card>

                <Card>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">
                                Base de conhecimento
                            </h2>
                            <p className="mt-1 text-sm text-gray-500">
                                O agente busca aqui antes de responder dúvidas sobre o produto.
                            </p>
                        </div>
                        <Button
                            variant="secondary"
                            onClick={() => startEditing()}
                        >
                            + Adicionar
                        </Button>
                    </div>

                    {knowledgeEditorOpen && (
                        <div className="mt-5 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <Input
                                label="Título"
                                value={knowledgeTitle}
                                onChange={(event) =>
                                    setKnowledgeTitle(event.target.value)
                                }
                            />
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-gray-800">
                                    Conteúdo
                                </label>
                                <Textarea
                                    value={knowledgeContent}
                                    onChange={(event) =>
                                        setKnowledgeContent(event.target.value)
                                    }
                                    rows={5}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => void saveKnowledge()}
                                    loading={action === "save_knowledge"}
                                >
                                    Salvar
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        setEditingId(null);
                                        setKnowledgeTitle("");
                                        setKnowledgeContent("");
                                        setKnowledgeEditorOpen(false);
                                    }}
                                >
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="mt-5 divide-y divide-gray-100 rounded-xl border border-gray-200">
                        {data?.knowledge.map((entry) => (
                            <div
                                key={entry.id}
                                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <p className="font-medium text-gray-900">
                                        {entry.title}
                                    </p>
                                    <p className="mt-1 text-sm text-gray-600">
                                        {entry.content}
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <Button
                                        variant="secondary"
                                        onClick={() => startEditing(entry)}
                                    >
                                        Editar
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        onClick={() =>
                                            void runAction(
                                                "delete_knowledge",
                                                { id: entry.id }
                                            )
                                        }
                                    >
                                        Excluir
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card>
                    <h2 className="text-lg font-semibold text-gray-900">
                        Conversas recentes
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        O restaurante é identificado automaticamente pelo número do WhatsApp quando possível.
                    </p>

                    <div className="mt-5 divide-y divide-gray-100 rounded-xl border border-gray-200">
                        {data?.conversations.length ? (
                            data.conversations.map((conversation) => (
                                <div
                                    key={conversation.id}
                                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-medium text-gray-900">
                                                {conversation.customer_name ||
                                                    formatPhone(conversation.phone)}
                                            </p>
                                            <span
                                                className={
                                                    "rounded-full px-2 py-0.5 text-xs font-medium " +
                                                    (conversation.mode === "ai"
                                                        ? "bg-green-50 text-green-700"
                                                        : "bg-amber-50 text-amber-700")
                                                }
                                            >
                                                {conversation.mode === "ai"
                                                    ? "IA"
                                                    : "Humano"}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">
                                            {conversation.restaurant_name ||
                                                "Restaurante não identificado"}{" "}
                                            · {formatPhone(conversation.phone)}
                                        </p>
                                        <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                                            {conversation.last_message || "—"}
                                        </p>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        onClick={() =>
                                            void runAction(
                                                "set_conversation_mode",
                                                {
                                                    id: conversation.id,
                                                    mode:
                                                        conversation.mode ===
                                                        "ai"
                                                            ? "human"
                                                            : "ai",
                                                }
                                            )
                                        }
                                    >
                                        <FontAwesomeIcon
                                            icon={
                                                conversation.mode === "ai"
                                                    ? faUser
                                                    : faRobot
                                            }
                                            className="mr-2"
                                        />
                                        {conversation.mode === "ai"
                                            ? "Assumir"
                                            : "Reativar IA"}
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <p className="p-8 text-center text-sm text-gray-500">
                                Nenhuma conversa ainda.
                            </p>
                        )}
                    </div>
                </Card>
            </div>
        </main>
    );
}
