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

import {Send, Bot, MessageCircle, SquareArrowOutUpRight} from "lucide-react";
import BlastHistorySection from "@/components/dev/BlastHistorySection";
import SupportConversation from "@/components/dev/SupportConversation";
import SupportDraftsSection from "@/components/dev/SupportDraftsSection";
import Pagination from "@/components/ui/Pagination";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import DataTable from "@/components/ui/DataTable";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import Loader from "@/components/ui/Loader";
import DevDialog from "./DevDialog";
import DevPage from "./DevPage";
import Badge from "@/components/ui/Badge";
import styles from "./dashboard.module.css";
import Switch from "@/components/ui/Switch";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import Textarea from "@/components/ui/Textarea";
import { ABANDONED_BLAST_MESSAGE } from "@/lib/dev/abandonedBlast";
import {
    DID_NOT_ACTIVATE_BLAST_MESSAGE,
    DID_NOT_ACTIVATE_BLAST_PREFILL_STORAGE_KEY,
} from "@/lib/dev/didNotActivateBlast";
import { supabase } from "@/lib/database/supabaseClient";
import { parseBulkPhones, parseBulkRecipients, renderBulkMessage, type BulkInputRecipient } from "@/lib/dev/supportBulk";
import type { AccessState, BlastCampaign, BlastRecipient, Connection, Stats, KnowledgeEntry, Conversation, DashboardData } from "@/lib/dev/supportTypes";
import { formatPhone, getWhatsappUrl, statusPresentation } from "@/lib/dev/supportView";

import { useDevProfile, PhoneLink } from "./DevProfileProvider";
import { formatResponseTime } from "@/lib/dev/dashboardFormat";

type WhatsAppConnectionKind = "support" | "blast";

function WhatsAppConnectionCard({
    kind,
    connection,
    action,
    onAction,
}: {
    kind: WhatsAppConnectionKind;
    connection: Connection | null;
    action: string;
    onAction: (nextAction: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
    const isBlast = kind === "blast";
    const currentStatus = statusPresentation(connection);
    const showQrCode =
        connection?.desired_state === "connected" &&
        connection.status === "SCAN_QR_CODE";
    const actionPending = action.endsWith(":" + kind);

    return (
        <Card>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-xl text-green-600">
                        <FontAwesomeIcon icon={faWhatsapp} />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {isBlast ? "Blast (remetente)" : "Suporte"}
                            </h2>
                            <span className={"rounded-full px-2.5 py-1 text-xs font-medium " + currentStatus.className}>
                                {currentStatus.label}
                            </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                            Sessão: {connection?.session_name || (isBlast ? "imenu-blast" : "imenu-support")}
                        </p>
                        {connection?.phone && (
                            <p className="mt-1 text-sm font-medium text-gray-800">
                                {connection.push_name || (isBlast ? "Blast iMenu" : "Suporte iMenu")} · {formatPhone(connection.phone)}
                            </p>
                        )}
                        {connection?.last_error && (
                            <p className="mt-2 text-sm text-red-600">{connection.last_error}</p>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {!connection || connection.desired_state === "disconnected" ? (
                        <Button
                            onClick={() => void onAction("connect", { connection: kind })}
                            loading={action === "connect:" + kind}
                            disabled={actionPending}
                        >
                            <FontAwesomeIcon icon={faQrcode} className="mr-2" />
                            Conectar WhatsApp
                        </Button>
                    ) : (
                        <>
                            {connection.status !== "WORKING" && (
                                <>
                                    <Button
                                        onClick={() => void onAction("reconnect", { connection: kind })}
                                        loading={action === "reconnect:" + kind}
                                        disabled={actionPending}
                                    >
                                        <FontAwesomeIcon icon={faRotate} className="mr-2" />
                                        Reconectar
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        onClick={() => void onAction("refresh_qr", { connection: kind })}
                                        loading={action === "refresh_qr:" + kind}
                                        disabled={actionPending}
                                    >
                                        Novo QR
                                    </Button>
                                </>
                            )}
                            <Button
                                variant="secondary"
                                onClick={() => void onAction("disconnect", { connection: kind })}
                                loading={action === "disconnect:" + kind}
                                disabled={actionPending}
                            >
                                <FontAwesomeIcon icon={faPowerOff} className="mr-2" />
                                Desconectar
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4">
                <div>
                    <p className="font-medium text-gray-900">Respostas por IA</p>
                    <p className="text-sm text-gray-500">
                        {isBlast
                            ? "Responde automaticamente pessoas que receberam disparos por este número."
                            : "Notificações automáticas continuam indo direto pelo WAHA."}
                    </p>
                </div>
                {isBlast ? (
                    <Switch
                        checked={connection?.bot_enabled ?? true}
                        disabled={action === "set_bot_enabled:blast"}
                        aria-label="Ativar respostas por IA no Blast (remetente)"
                        onClick={() => void onAction("set_bot_enabled", {
                            connection: kind,
                            enabled: !(connection?.bot_enabled ?? true),
                        })}
                    />
                ) : (
                    <Button
                        variant={connection?.bot_enabled ? "secondary" : "primary"}
                        loading={action === "set_bot_enabled:support"}
                        onClick={() => void onAction("set_bot_enabled", {
                            connection: kind,
                            enabled: !connection?.bot_enabled,
                        })}
                    >
                        <FontAwesomeIcon
                            icon={connection?.bot_enabled ? faCircleCheck : faRobot}
                            className="mr-2"
                        />
                        {connection?.bot_enabled ? "IA ativa" : "Ativar IA"}
                    </Button>
                )}
            </div>

            {showQrCode && (
                <div className="mt-6 grid gap-5 rounded-xl border border-blue-100 bg-blue-50/40 p-5 sm:grid-cols-[220px_1fr] sm:items-center">
                    <div className="flex min-h-[210px] items-center justify-center rounded-xl border border-gray-200 bg-white p-3">
                        {connection?.qr_code_data ? (
                            <img
                                src={connection.qr_code_data}
                                alt={isBlast ? "QR Code do WhatsApp Blast" : "QR Code do WhatsApp de suporte"}
                                className="h-48 w-48"
                            />
                        ) : (
                            <p className="text-sm text-gray-500">Preparando QR…</p>
                        )}
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">
                            {isBlast ? "Escaneie com o número secundário" : "Escaneie com o número do suporte iMenu"}
                        </h3>
                        <p className="mt-2 text-sm text-gray-600">
                            WhatsApp → Aparelhos conectados → Conectar um aparelho.
                        </p>
                    </div>
                </div>
            )}
        </Card>
    );
}

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";
export default function SupportSection({ section = "support" }: { section?: "support" | "blast" | "legacy" }) {
    const router = useRouter();
    const { openProfile } = useDevProfile();
    const [accessState, setAccessState] =
        useState<AccessState>("checking");
    const [supportPage, setSupportPage] = useState(0);
    const [selectedConversation,setSelectedConversation] = useState<Conversation|null>(null);
    const [handoffPage, setHandoffPage] = useState(0);
    const [knowledgePage, setKnowledgePage] = useState(0);
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [action, setAction] = useState("");
    const [error, setError] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [knowledgeEditorOpen, setKnowledgeEditorOpen] = useState(false);
    const [knowledgeTitle, setKnowledgeTitle] = useState("");
    const [knowledgeContent, setKnowledgeContent] = useState("");
    const [composeOpen,setComposeOpen] = useState(false);
    const [bulkPhones, setBulkPhones] = useState("");
    const [bulkMessage, setBulkMessage] = useState("");
    const [bulkImage, setBulkImage] = useState<File | null>(null);
    const [bulkImageUrl, setBulkImageUrl] = useState("");
    const [bulkSending, setBulkSending] = useState(false);
    const [bulkPreview, setBulkPreview] = useState<Array<{ phone: string; message: string }> | null>(null);
    const [bulkStatus, setBulkStatus] = useState("");
    const [bulkSkipRecent, setBulkSkipRecent] = useState(true);
    const [bulkSender, setBulkSender] = useState<"blast" | "support">("blast");
    const [bulkCadenceEnabled, setBulkCadenceEnabled] = useState(false);
    const [bulkCadence, setBulkCadence] = useState("200");
    const [blastRevision, setBlastRevision] = useState(0);
    const [blastHistory, setBlastHistory] = useState<BlastCampaign[]>([]);
    const [blastHistoryLoading, setBlastHistoryLoading] = useState(false);
    const [selectedBlastId, setSelectedBlastId] = useState<string | null>(null);
    const [blastRecipients, setBlastRecipients] = useState<BlastRecipient[]>([]);
    const [blastAction, setBlastAction] = useState("");

    useEffect(() => {
        if (!bulkImage) {
            setBulkImageUrl("");
            return;
        }
        const url = URL.createObjectURL(bulkImage);
        setBulkImageUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [bulkImage]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("blast") !== "did-not-activate") return;
        if (section !== "blast") { window.location.replace("/dev/blast?blast=did-not-activate"); return; }

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

            setComposeOpen(true);
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

        const response = await fetch(`/api/dev/support?support_page=${supportPage}&handoff_page=${handoffPage}&knowledge_page=${knowledgePage}`, {
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
    }, [getAccessToken, supportPage, handoffPage, knowledgePage]);

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
        setBlastRevision(value => value + 1);
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
            await loadDashboard();
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
        if (!recipients.length || (!messageTemplate && !bulkImage)) {
            setBulkStatus("Informe pelo menos um número e uma mensagem ou imagem.");
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
                    return { phone, message: messageTemplate ? renderBulkMessage(messageTemplate, values).trim() : "" };
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

            if (!bulkCadenceEnabled && !bulkImage) {
                window.alert("Deixe esta aba aberta durante o envio.");

                const batchId = window.crypto.randomUUID();
                let sent = 0;
                let skipped = 0;
                let failed = 0;
                let previousStartedAt = 0;

                for (let index = 0; index < resolvedRecipients.length; index += 1) {
                    if (previousStartedAt) {
                        const remainingDelay = 25_000 - (Date.now() - previousStartedAt);
                        if (remainingDelay > 0) {
                            await new Promise((resolve) =>
                                window.setTimeout(resolve, remainingDelay)
                            );
                        }
                    }

                    previousStartedAt = Date.now();
                    const recipient = resolvedRecipients[index];
                    setBulkStatus(
                        `Enviando ${index + 1}/${resolvedRecipients.length}...`
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
                            phone: recipient.phone,
                            message: recipient.message,
                            skipRecent: bulkSkipRecent,
                            sender: bulkSender,
                        }),
                    });
                    const payload = (await response.json()) as {
                        error?: string;
                        skippedRecent?: boolean;
                        duplicate?: boolean;
                    };

                    if (response.status === 401) {
                        setAccessState("signed-out");
                        throw new Error("Sessão expirada. Entre novamente.");
                    }
                    if (!response.ok) {
                        failed += 1;
                        continue;
                    }
                    if (payload.skippedRecent || payload.duplicate) {
                        skipped += 1;
                    } else {
                        sent += 1;
                    }
                }

                setBulkPhones("");
                setBulkPreview(null);
                setBulkStatus(
                    `Envio concluído. ${sent} enviado(s), ${skipped} ignorado(s), ${failed} falha(s).`
                );
                return;
            }

            const imageForm = new FormData();
            if (bulkImage) {
                imageForm.set("action", "create_blast");
                imageForm.set("connection", bulkSender);
                imageForm.set("message", messageTemplate);
                imageForm.set("dailyLimit", String(dailyLimit));
                imageForm.set("skipRecent", String(bulkSkipRecent));
                imageForm.set("recipients", JSON.stringify(resolvedRecipients));
                imageForm.set("image", bulkImage);
            }
            const response = await fetch("/api/dev/support", {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + token,
                    ...(!bulkImage ? { "Content-Type": "application/json" } : {}),
                },
                body: bulkImage ? imageForm : JSON.stringify({
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
            setBulkImage(null);
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
    const showQr =
        connection?.desired_state === "connected" &&
        connection.status === "SCAN_QR_CODE";
    const selectedBulkConnection =
        bulkSender === "blast" ? blastConnection : connection;

    return (<DevPage title={section === "blast" ? "Blast" : "Support"} compactActions={section !== "support"} actions={section !== "support" ? <Button onClick={()=>setComposeOpen(true)}><Send size={16} aria-hidden="true" className="mr-2"/>Envio em massa</Button> : undefined}>
                {error && (
                    <Card className="border-red-200 bg-red-50">
                        <p className="text-sm text-red-700">{error}</p>
                    </Card>
                )}

                {section !== "blast" && <>
                <dl className={styles.metricStrip} aria-label="Indicadores de atendimento">
                    <div>
                        <dt>Resposta média · Bot</dt>
                        <dd className="tabular-nums">{formatResponseTime(data?.responseTimes?.bot_seconds)}</dd>
                        <p>Últimos 30 dias{data?.responseTimes && data.responseTimes.excluded_responses > 0 && (
                            <span> · {data.responseTimes.excluded_responses} excluídos · média {formatResponseTime(data.responseTimes.excluded_avg_seconds)}</span>
                        )}</p>
                    </div>
                    <div>
                        <dt>Resposta média · Humano</dt>
                        <dd className="tabular-nums">{formatResponseTime(data?.responseTimes?.human_seconds)}</dd>
                        <p>Últimos 30 dias</p>
                    </div>
                </dl>
                <section className={`${styles.tableSection} ${styles.supportTable} ${styles.supportHandoffs}`}>
                    <h2>Atendimento humano</h2>
                    <DataTable rows={data?.handedOff || []} rowKey={conversation => conversation.id} emptyMessage="Nenhuma conversa em atendimento humano." columns={[
                        { key: "restaurant", label: "Restaurante", render: conversation => <div className="flex min-w-0 items-center gap-2">{conversation.restaurant_id ? <button type="button" className={styles.profileLink} onClick={() => openProfile({id:conversation.restaurant_id!,name:conversation.restaurant_name || "Restaurante"})}>{conversation.restaurant_name || "Restaurante"}</button> : <span>Restaurante não identificado</span>}{conversation.plus && <Badge variant="brand" className="shrink-0 whitespace-nowrap">iMenu Plus</Badge>}</div> },
                        { key: "attended", label: "Situação", render: conversation => <Badge variant={conversation.attended ? "success" : "danger"}>{conversation.attended ? "Atendido" : "Aguardando"}</Badge> },
                        { key: "owner", label: "Celular dono", render: conversation => <PhoneLink phone={conversation.owner_phone} /> },
                        { key: "store", label: "Celular restaurante", render: conversation => <PhoneLink phone={conversation.store_phone} /> },
                        {key:"context",label:"Última mensagem",render:conversation=><p className="truncate" title={conversation.last_message || undefined}>{conversation.last_message || "—"}</p>},
                        { key: "actions", label: "", render: conversation => <div className="flex justify-end gap-1"><button type="button" title="Reativar IA" aria-label="Reativar IA" disabled={action === "set_conversation_mode"} className={styles.supportIcon} onClick={() => void runAction("set_conversation_mode", { id: conversation.id, mode: "ai" })}><Bot size={16} aria-hidden="true" /></button><button type="button" title="Ver mensagens" aria-label="Ver mensagens" className={styles.supportIcon} onClick={()=>setSelectedConversation(conversation)}><MessageCircle size={16} aria-hidden="true"/></button><button type="button" title="Abrir WhatsApp" aria-label="Abrir WhatsApp" className={styles.supportIcon} disabled={!getWhatsappUrl(conversation.phone)} onClick={() => { const url = getWhatsappUrl(conversation.phone); if (url) window.open(url, "_blank", "noopener,noreferrer"); }}><SquareArrowOutUpRight size={16} aria-hidden="true" /></button></div> },
                    ]} />
                    {(data?.stats.human_conversations || 0) > 25 && <div className={styles.tableFooter}><Pagination page={handoffPage} pageCount={Math.ceil((data?.stats.human_conversations || 0) / 25)} onChange={setHandoffPage} /></div>}
                </section>

                <DevDialog title="Conversa" description={selectedConversation?.restaurant_name || selectedConversation?.customer_name || undefined} open={Boolean(selectedConversation)} onClose={()=>setSelectedConversation(null)}>
                    {selectedConversation && <SupportConversation url={"/api/dev/support/drafts?conversation_id="+selectedConversation.id}/>}
                </DevDialog>

               {section === "support" && <SupportDraftsSection/>}
               {section === "legacy" && <>
                <Card>
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-xl text-green-600">
                                <FontAwesomeIcon icon={faWhatsapp} />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        Suporte
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

                </>}
                </>}
                {section !== "support" && <>
                <BlastHistorySection refreshKey={blastRevision} connections={{support:connection,blast:blastConnection}}/>
                <DevDialog title="Envio em massa" open={composeOpen && bulkPreview === null} onClose={()=>{if(!bulkSending)setComposeOpen(false);}}>                <Card className={styles.composer}>
                    <p className="mt-1 text-sm text-gray-500">
                        Prepare os destinatários e a mensagem. Você poderá conferir tudo antes de enviar.
                    </p>

                    <div className={styles.composerSettings}>
                    <div>
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
                                        "Blast" +
                                        (blastConnection?.phone
                                            ? " · " + formatPhone(blastConnection.phone)
                                            : " · não conectado"),
                                },
                                {
                                    value: "support",
                                    label:
                                        "Suporte" +
                                        (connection?.phone
                                            ? " · " + formatPhone(connection.phone)
                                            : " · não conectado"),
                                },
                            ]}
                        />
                    </div>

                    <div className={styles.cadence}>
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

                    </div>
                    <div className="mt-5 grid gap-5 md:grid-cols-2">
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

                    <div className="mt-4">
                        <label htmlFor="blast-image" className="mb-1.5 block text-xs font-medium text-gray-800">
                            Imagem (opcional)
                        </label>
                        <input
                            id="blast-image"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={bulkSending}
                            onChange={(event) => {
                                const file = event.target.files?.[0] || null;
                                event.target.value = "";
                                if (file && (file.size > 8 * 1024 * 1024 ||
                                    !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
                                    setBulkStatus("Escolha uma imagem JPG, PNG ou WebP de até 8 MB.");
                                    return;
                                }
                                setBulkImage(file);
                                setBulkPreview(null);
                                setBulkStatus("");
                            }}
                            className="block w-full max-w-md rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700"
                        />
                        {bulkImage && bulkImageUrl && (
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                <img src={bulkImageUrl} alt="Prévia da imagem do envio" className="h-24 w-24 rounded-lg border border-gray-200 object-cover" />
                                <div className="min-w-0">
                                    <p className="max-w-64 truncate text-sm text-gray-700">{bulkImage.name}</p>
                                    <Button variant="secondary" disabled={bulkSending} onClick={() => setBulkImage(null)}>
                                        Remover imagem
                                    </Button>
                                </div>
                            </div>
                        )}
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

                    <div className="mt-4 text-xs leading-5 text-gray-500">
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
                                (!bulkMessage.trim() && !bulkImage) ||
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
                </DevDialog>

                <DevDialog title="Conferir mensagens antes do envio"
                    open={bulkPreview !== null}
                    onClose={() => { if (!bulkSending) setBulkPreview(null); }}
                >
                    <div className="p-5 sm:p-6">
                        <p className="mt-2 text-sm text-gray-500">
                            Confira se nomes, cidades e estabelecimentos estão corretos.
                            {bulkPreview ? ` ${bulkPreview.length} destinatário(s); prévia dos primeiros ${Math.min(20, bulkPreview.length)}.` : ""}
                        </p>
                        {bulkImageUrl && (
                            <img src={bulkImageUrl} alt="Imagem que será enviada" className="mt-4 max-h-52 max-w-full rounded-lg border border-gray-200 object-contain" />
                        )}
                        <div className="mt-4 max-h-[48dvh] space-y-3 overflow-y-auto">
                            {bulkPreview?.slice(0, 20).map((recipient, index) => (
                                <div key={index} className="rounded-lg border border-gray-200 p-3">
                                    <p className="mb-2 text-xs font-medium text-gray-600">
                                        {index + 1}. {formatPhone(recipient.phone)}
                                    </p>
                                    <p className="whitespace-pre-wrap text-sm text-gray-800">{recipient.message || "Imagem sem legenda"}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-5 flex flex-wrap justify-end gap-3">
                            <Button variant="secondary" onClick={() => setBulkPreview(null)} disabled={bulkSending}>Voltar</Button>
                            <Button onClick={() => void startBulkSend(true)} loading={bulkSending}>Confirmar envio</Button>
                        </div>
                    </div>
                </DevDialog>

                </>}

                {section === "legacy" && <>
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

                <Pagination page={knowledgePage} pageCount={Math.ceil((data?.stats.total_knowledge || 0) / 25)} onChange={setKnowledgePage} />
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
                                    className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${conversation.plus ? "bg-orange-50/60" : ""}`}
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
                    <Pagination page={supportPage} pageCount={Math.ceil((data?.stats.total_conversations || 0) / 25)} onChange={setSupportPage} />
                </Card>
                </>}

                {section !== "legacy" && (
                    <WhatsAppConnectionCard
                        kind={section === "blast" ? "blast" : "support"}
                        connection={section === "blast" ? blastConnection : connection}
                        action={action}
                        onAction={runAction}
                    />
                )}
        </DevPage>
    );
}
