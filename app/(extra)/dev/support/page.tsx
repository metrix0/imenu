"use client";

import { useCallback, useEffect, useState } from "react";
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
import Modal from "@/components/ui/Modal";
import Switch from "@/components/ui/Switch";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import Textarea from "@/components/ui/Textarea";
import { ABANDONED_BLAST_MESSAGE } from "@/lib/dev/abandonedBlast";
import {
    DID_NOT_ACTIVATE_BLAST_MESSAGE,
    DID_NOT_ACTIVATE_BLAST_PREFILL_STORAGE_KEY,
} from "@/lib/dev/didNotActivateBlast";
import { supabase } from "@/lib/database/supabaseClient";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";
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
            const normalizedKey = normalizeBulkHeader(key);
            const value =
                normalizedValues.get(normalizedKey) ||
                (normalizedKey === "cidade" ? normalizedValues.get("city") : "") ||
                (normalizedKey === "city" ? normalizedValues.get("cidade") : "") ||
                "";
            if (value && value !== "—" && value !== "-") return value;

            const fallbackValue = fallback.trim();
            if (fallbackValue) {
                const quoted = fallbackValue.match(/^(["'])([\s\S]*)\1$/);
                if (quoted && quoted[2].trim()) return quoted[2];

                const variable =
                    normalizedValues.get(normalizeBulkHeader(fallbackValue)) || "";
                if (variable && variable !== "—" && variable !== "-") return variable;
            }

            throw new Error(`Campo "${key.trim()}" vazio ou ausente na tabela. Corrija antes do envio.`);
        }
    );
}

type AccessState = "checking" | "allowed" | "forbidden" | "signed-out";

type BlastCampaign = {
    id: string;
    sender: "blast" | "support";
    message: string;
    daily_limit: number | null;
    status: "running" | "paused" | "cancelled" | "completed";
    total: number;
    sent: number;
    failed: number;
    skipped: number;
    pending: number;
    created_at: string;
    completed_at: string | null;
};

type BlastRecipient = {
    id: number;
    phone: string;
    status: string;
    error: string | null;
    scheduled_at: string;
    sent_at: string | null;
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
    const [bulkPreview, setBulkPreview] = useState<Array<{ phone: string; message: string }> | null>(null);
    const [bulkStatus, setBulkStatus] = useState("");
    const [bulkSkipRecent, setBulkSkipRecent] = useState(true);
    const [bulkSender, setBulkSender] = useState<"blast" | "support">("blast");
    const [bulkCadenceEnabled, setBulkCadenceEnabled] = useState(false);
    const [bulkCadence, setBulkCadence] = useState("200");
    const [blastHistory, setBlastHistory] = useState<BlastCampaign[]>([]);
    const [blastHistoryLoading, setBlastHistoryLoading] = useState(false);
    const [selectedBlastId, setSelectedBlastId] = useState<string | null>(null);
    const [blastRecipients, setBlastRecipients] = useState<BlastRecipient[]>([]);
    const [blastAction, setBlastAction] = useState("");

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("blast") !== "did-not-activate") return;

        const stored = window.sessionStorage.getItem(
            DID_NOT_ACTIVATE_BLAST_PREFILL_STORAGE_KEY
        );
        if (!stored) return;

        try {
            const prefill = JSON.parse(stored) as {
                phones?: string;
                message?: string;
            };
            if (!prefill.phones) return;

            setBulkPhones(prefill.phones);
            setBulkMessage(
                prefill.message === DID_NOT_ACTIVATE_BLAST_MESSAGE
                    ? prefill.message
                    : DID_NOT_ACTIVATE_BLAST_MESSAGE
            );
            setBulkSender("blast");
            setBulkSkipRecent(false);
        } catch {
            // Ignore invalid one-time prefill data.
        } finally {
            window.sessionStorage.removeItem(
                DID_NOT_ACTIVATE_BLAST_PREFILL_STORAGE_KEY
            );
        }
    }, []);

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

    const loadBlastHistory = useCallback(async () => {
        const token = await getAccessToken();
        if (!token) return;
        const response = await fetch("/api/dev/support?blast_history=1", {
            headers: { Authorization: "Bearer " + token },
            cache: "no-store",
        });
        const payload = (await response.json()) as { campaigns?: BlastCampaign[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Erro ao carregar histórico.");
        setBlastHistory(payload.campaigns || []);
    }, [getAccessToken]);

    const loadBlastRecipients = useCallback(async (id: string) => {
        const token = await getAccessToken();
        if (!token) return;
        const response = await fetch("/api/dev/support?blast_id=" + encodeURIComponent(id), {
            headers: { Authorization: "Bearer " + token },
            cache: "no-store",
        });
        const payload = (await response.json()) as { recipients?: BlastRecipient[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Erro ao carregar destinatários.");
        setBlastRecipients(payload.recipients || []);
    }, [getAccessToken]);

    useEffect(() => {
        if (accessState !== "allowed") return;
        setBlastHistoryLoading(true);
        void loadBlastHistory()
            .catch((caught) => setError(caught instanceof Error ? caught.message : "Erro ao carregar histórico."))
            .finally(() => setBlastHistoryLoading(false));
        const timer = window.setInterval(() => {
            void loadBlastHistory().catch(() => undefined);
            if (selectedBlastId) void loadBlastRecipients(selectedBlastId).catch(() => undefined);
        }, 30_000);
        return () => window.clearInterval(timer);
    }, [accessState, loadBlastHistory, loadBlastRecipients, selectedBlastId]);

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

    const startBulkSend = async (confirmed = false) => {
        const recipients = parseBulkRecipients(bulkPhones);
        const messageTemplate = bulkMessage.trim();
        const dailyLimit = bulkCadenceEnabled ? Number(bulkCadence) : null;
        if (!recipients.length || !messageTemplate) {
            setBulkStatus("Informe pelo menos um número e uma mensagem.");
            return;
        }
        if (bulkCadenceEnabled && (!Number.isInteger(dailyLimit) || dailyLimit! < 1 || dailyLimit! > 10000)) {
            setBulkStatus("Informe uma cadência de 1 a 10.000 mensagens por dia.");
            return;
        }
        let resolvedRecipients: Array<{ phone: string; message: string }>;
        try {
            resolvedRecipients = recipients.map(({ phone, values }, index) => {
                try {
                    return { phone, message: renderBulkMessage(messageTemplate, values).trim() };
                } catch (error) {
                    throw new Error(`Destinatário ${index + 1}: ${error instanceof Error ? error.message : "Dados inválidos."}`);
                }
            });
        } catch (error) {
            setBulkStatus(error instanceof Error ? error.message : "Verifique os campos da tabela.");
            return;
        }

        if (!confirmed) {
            setBulkPreview(resolvedRecipients);
            setBulkStatus("");
            return;
        }

        setBulkSending(true);
        setBulkStatus("");
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
                body: JSON.stringify({
                    action: "create_blast",
                    connection: bulkSender,
                    message: messageTemplate,
                    dailyLimit,
                    skipRecent: bulkSkipRecent,
                    recipients: resolvedRecipients,
                }),
            });
            const payload = (await response.json()) as { id?: string; error?: string };
            if (!response.ok || !payload.id) {
                throw new Error(payload.error || "Falha ao criar o envio.");
            }
            setBulkPhones("");
            setBulkPreview(null);
            setBulkStatus("Envio criado. Ele continuará automaticamente mesmo com a página fechada.");
            setSelectedBlastId(payload.id);
            await Promise.all([loadBlastHistory(), loadBlastRecipients(payload.id)]);
        } catch (caught) {
            setBulkStatus(caught instanceof Error ? caught.message : "Falha ao criar o envio.");
        } finally {
            setBulkSending(false);
        }
    };

    const updateBlast = async (id: string, nextStatus: "pause" | "resume" | "cancel") => {
        setBlastAction(id + ":" + nextStatus);
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
                body: JSON.stringify({
                    action: "set_blast_status",
                    id,
                    nextStatus,
                }),
            });
            const payload = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(payload.error || "Ação indisponível.");
            await loadBlastHistory();
            if (selectedBlastId === id) await loadBlastRecipients(id);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Ação indisponível.");
        } finally {
            setBlastAction("");
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
                        Os envios continuam no servidor, mesmo com a página fechada. Sem cadência, o intervalo é de aproximadamente 25 segundos.
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

                    <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 p-4">
                        <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900">Cadência</p>
                            <p className="text-sm text-gray-500">
                                Limita este envio a uma quantidade por dia, distribuída das 8h às 21h (horário de Brasília).
                            </p>
                        </div>
                        <Switch
                            checked={bulkCadenceEnabled}
                            disabled={bulkSending}
                            aria-label="Ativar cadência neste envio"
                            onClick={() => setBulkCadenceEnabled(!bulkCadenceEnabled)}
                        />
                        {bulkCadenceEnabled && (
                            <div className="w-36">
                                <Input
                                    label="Mensagens por dia"
                                    type="number"
                                    min={1}
                                    max={10000}
                                    value={bulkCadence}
                                    disabled={bulkSending}
                                    onChange={(event) => setBulkCadence(event.target.value)}
                                />
                            </div>
                        )}
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
                            Você pode fechar esta página depois de iniciar: o envio continuará no servidor.
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
                            loading={bulkSending}
                            disabled={
                                bulkSending ||
                                !bulkMessage.trim() ||
                                !parseBulkPhones(bulkPhones).length ||
                                selectedBulkConnection?.status !== "WORKING"
                            }
                        >
                            Enviar em massa
                        </Button>
                    </div>
                    {bulkStatus && (
                        <p className="mt-3 text-sm text-gray-600">{bulkStatus}</p>
                    )}
                </Card>

                <Modal
                    open={bulkPreview !== null}
                    onClose={() => { if (!bulkSending) setBulkPreview(null); }}
                    height="80dvh"
                    className="max-w-2xl"
                >
                    <div className="p-5 sm:p-6">
                        <h3 className="text-lg font-semibold text-gray-900">Conferir mensagens antes do envio</h3>
                        <p className="mt-2 text-sm text-gray-500">
                            Confira se nomes, cidades e estabelecimentos estão corretos.
                            {bulkPreview ? ` ${bulkPreview.length} destinatário(s); prévia dos primeiros ${Math.min(20, bulkPreview.length)}.` : ""}
                        </p>
                        <div className="mt-4 max-h-[48dvh] space-y-3 overflow-y-auto">
                            {bulkPreview?.slice(0, 20).map((recipient, index) => (
                                <div key={index} className="rounded-lg border border-gray-200 p-3">
                                    <p className="mb-2 text-xs font-medium text-gray-600">
                                        {index + 1}. {formatPhone(recipient.phone)}
                                    </p>
                                    <p className="whitespace-pre-wrap text-sm text-gray-800">{recipient.message}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-5 flex flex-wrap justify-end gap-3">
                            <Button variant="secondary" onClick={() => setBulkPreview(null)} disabled={bulkSending}>Voltar</Button>
                            <Button onClick={() => void startBulkSend(true)} loading={bulkSending}>Confirmar envio</Button>
                        </div>
                    </div>
                </Modal>

                <Card>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Histórico de envios</h2>
                            <p className="mt-1 text-sm text-gray-500">
                                Acompanhe o andamento, pause ou interrompa qualquer envio.
                            </p>
                        </div>
                        <Button variant="secondary" onClick={() => void loadBlastHistory().catch((caught) =>
                            setError(caught instanceof Error ? caught.message : "Falha ao atualizar.")
                        )}>Atualizar</Button>
                    </div>
                    <div className="mt-5 divide-y divide-gray-100 rounded-xl border border-gray-200">
                        {blastHistoryLoading && !blastHistory.length && (
                            <p className="p-4 text-sm text-gray-500">Carregando histórico...</p>
                        )}
                        {!blastHistoryLoading && !blastHistory.length && (
                            <p className="p-4 text-sm text-gray-500">Nenhum envio registrado ainda.</p>
                        )}
                        {blastHistory.map((campaign) => (
                            <div key={campaign.id} className="p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <button type="button" className="min-w-0 flex-1 cursor-pointer text-left"
                                        onClick={() => {
                                            if (selectedBlastId === campaign.id) {
                                                setSelectedBlastId(null);
                                                return;
                                            }
                                            setSelectedBlastId(campaign.id);
                                            setBlastRecipients([]);
                                            void loadBlastRecipients(campaign.id).catch((caught) =>
                                                setError(caught instanceof Error ? caught.message : "Falha ao abrir envio.")
                                            );
                                        }}>
                                        <p className="truncate font-medium text-gray-900">{campaign.message}</p>
                                        <p className="mt-1 text-xs text-gray-500">
                                            {new Date(campaign.created_at).toLocaleString("pt-BR")} ·{" "}
                                            {campaign.message === ABANDONED_BLAST_MESSAGE ? "Automático · Abandonados · " : ""}
                                            {campaign.sender === "blast" ? "WhatsApp Blast" : "WhatsApp suporte"} ·{" "}
                                            {campaign.daily_limit ? campaign.daily_limit + "/dia" : "Sem cadência"}
                                        </p>
                                        <p className="mt-2 text-sm text-gray-600">
                                            {campaign.sent}/{campaign.total} enviados · {campaign.pending} pendentes ·{" "}
                                            {campaign.skipped} ignorados · {campaign.failed} falhas ·{" "}
                                            {campaign.status === "running" ? "Em andamento"
                                                : campaign.status === "paused" ? "Pausado"
                                                : campaign.status === "cancelled" ? "Interrompido" : "Concluído"}
                                        </p>
                                    </button>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {campaign.status === "running" && (
                                            <Button variant="secondary"
                                                loading={blastAction === campaign.id + ":pause"}
                                                onClick={() => void updateBlast(campaign.id, "pause")}>Pausar</Button>
                                        )}
                                        {campaign.status === "paused" && (
                                            <Button variant="secondary"
                                                loading={blastAction === campaign.id + ":resume"}
                                                onClick={() => void updateBlast(campaign.id, "resume")}>Retomar</Button>
                                        )}
                                        {(campaign.status === "running" || campaign.status === "paused") && (
                                            <Button variant="secondary"
                                                loading={blastAction === campaign.id + ":cancel"}
                                                onClick={() => void updateBlast(campaign.id, "cancel")}>Parar</Button>
                                        )}
                                    </div>
                                </div>
                                {selectedBlastId === campaign.id && (
                                    <div className="mt-4 max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
                                        <p className="px-3 py-2 text-xs text-gray-500">
                                            Primeiros 500 destinatários
                                        </p>
                                        {blastRecipients.map((recipient) => (
                                            <div key={recipient.id} className="flex flex-wrap justify-between gap-3 px-3 py-2 text-sm">
                                                <span className="text-gray-700">{formatPhone(recipient.phone)}</span>
                                                <span className={recipient.status === "sent" ? "text-green-700" :
                                                    recipient.status === "failed" ? "text-red-700" : "text-gray-500"}>
                                                    {recipient.status === "sent" ? "Enviado" :
                                                        recipient.status === "failed" ? "Falhou: " + (recipient.error || "") :
                                                        recipient.status === "skipped_recent" ? "Ignorado (7 dias)" :
                                                        recipient.status === "skipped_monthly" ? "Ignorado (envio recente/neste mês)" :
                                                        recipient.status === "skipped_30d" ? "Ignorado (últimos 30 dias)" :
                                                        recipient.status === "skipped_reactivated" ? "Ignorado (voltou a receber pedidos)" :
                                                        recipient.status === "cancelled" ? "Interrompido" :
                                                        recipient.status === "processing" ? "Enviando" :
                                                        "Agendado: " + new Date(recipient.scheduled_at).toLocaleString("pt-BR")}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
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
