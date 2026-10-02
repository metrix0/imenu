"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Sparkles,
  Plus,
  Send,
  Paperclip,
  History,
  X,
  Pencil,
  Archive,
  MessageSquare,
  ArrowUpRight,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Loader from "@/components/ui/Loader";
import { useSalesStore } from "@/lib/stores/restaurant-owner/iaVendasStore";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import AnalysisReport from "@/components/restaurant-owner/ia-vendas/AnalysisReport";
import SalesMarkdown from "@/components/restaurant-owner/ia-vendas/SalesMarkdown";
import {
  ActionCard,
  ActionPreview,
  DataCard,
} from "@/components/restaurant-owner/ia-vendas/SalesWidgets";
import type { Data } from "@/lib/ia-vendas/types";

type MessagePart =
  | { type: "text"; content: string }
  | { type: "action"; id: string }
  | { type: "card"; cardType: "benchmark" | "measurement" | "potential" };

function splitMessageParts(content: string): MessagePart[] {
  return content
    .split(
      /(\[\[(?:action|image):[0-9a-f-]{36}\]\]|\[\[card:(?:benchmark|measurement|potential)\]\])/gi,
    )
    .filter((part) => part.trim())
    .map((part) => {
      const action = /^\[\[(?:action|image):([0-9a-f-]{36})\]\]$/i.exec(part);
      if (action) return { type: "action", id: action[1] };
      const card = /^\[\[card:(benchmark|measurement|potential)\]\]$/i.exec(
        part,
      );
      if (card)
        return {
          type: "card",
          cardType: card[1].toLowerCase() as
            "benchmark" | "measurement" | "potential",
        };
      return { type: "text", content: part };
    });
}

export default function SalesPage() {
  const sales = useSalesStore(),
    restaurant = useCreationStore((s) => s.restaurantId),
    [selectedReportId, setSelectedReportId] = useState(""),
    [opportunity, setOpportunity] = useState<Data | null>(null),
    [analysisChatOpen, setAnalysisChatOpen] = useState(false),
    [wideAnalysis, setWideAnalysis] = useState(false),
    [text, setText] = useState(""),
    [attachments, setAttachments] = useState<Data[]>([]),
    [uploading, setUploading] = useState(false),
    [localError, setLocalError] = useState(""),
    [modal, setModal] = useState<
      "batch" | "history" | "instructions" | "rename" | null
    >(null),
    [renameConversationId, setRenameConversationId] = useState(""),
    [renameTitle, setRenameTitle] = useState(""),
    [instructions, setInstructions] = useState(""),
    [batchIds, setBatchIds] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null),
    lastMessage = useRef<HTMLElement>(null),
    previousMessages = useRef({ conversationId: "", count: 0 }),
    emptyThreadStart = useRef(Date.now()),
    file = useRef<HTMLInputElement>(null),
    input = useRef<HTMLTextAreaElement>(null),
    chatTrigger = useRef<HTMLButtonElement>(null),
    focusChat = useRef(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const update = () => {
      setWideAnalysis(media.matches);
      setAnalysisChatOpen(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!focusChat.current || (!wideAnalysis && !analysisChatOpen)) return;
    let frame = 0;
    const focusComposer = () => {
      // The mobile Modal mounts its portal after opening.
      if (!input.current) {
        frame = requestAnimationFrame(focusComposer);
        return;
      }
      input.current.focus();
      focusChat.current = false;
    };
    frame = requestAnimationFrame(focusComposer);
    return () => cancelAnimationFrame(frame);
  }, [analysisChatOpen, wideAnalysis, opportunity?.id]);
  useEffect(() => {
    void useSalesStore.getState().load(restaurant);
  }, [restaurant]);
  useEffect(() => {
    const previous = previousMessages.current;
    const conversationId = sales.conversation_id || "";
    const sameConversation = previous.conversationId === conversationId;
    const appended = sameConversation && sales.messages.length > previous.count;
    const last = sales.messages[sales.messages.length - 1];

    if (
      sales.conversations.find((c) => c.id === sales.conversation_id)?.kind ===
      "analysis"
    ) {
      if (appended && last?.report_id)
        end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } else if (appended && last?.role === "assistant") {
      lastMessage.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else if (!sameConversation || appended) {
      end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }

    previousMessages.current = {
      conversationId,
      count: sales.messages.length,
    };
  }, [sales.messages.length, sales.conversation_id]);
  useEffect(() => {
    emptyThreadStart.current = Date.now();
    setText("");
    setAttachments([]);
    setSelectedReportId("");
    setOpportunity(null);
    setAnalysisChatOpen(false);
  }, [sales.conversation_id]);
  useEffect(() => {
    if (!input.current) return;
    input.current.style.height = "auto";
    input.current.style.height = `${input.current.scrollHeight}px`;
  }, [text, wideAnalysis, analysisChatOpen]);
  useEffect(() => {
    if (!sales.running || sales.busy) return;
    const timer = setInterval(
      () =>
        void useSalesStore
          .getState()
          .load(restaurant, sales.conversation_id || undefined),
      10000,
    );
    return () => clearInterval(timer);
  }, [sales.running?.id, sales.busy, sales.conversation_id, restaurant]);
  const conversation = sales.conversations.find(
      (c) => c.id === sales.conversation_id,
    ),
    disabled = sales.busy || sales.acting || !!sales.running,
    isAnalysis = conversation?.kind === "analysis",
    analysisRunning = isAnalysis && !!(sales.running && sales.analyses.some((a) => a.id === sales.running?.id)),
    selectedReport =
      sales.analyses.find((a) => a.id === selectedReportId) ||
      sales.analyses.find((a) => a.result?.report),
    threadMessages = isAnalysis
      ? sales.messages.filter(
          (m) =>
            (!analysisRunning || !!m.report_id) &&
            (!m.report_id || m.report_id === selectedReport?.id) &&
            (!opportunity || m.opportunity_id === opportunity.id) &&
            (selectedReport ?
              m.report_id ||
              Date.parse(m.created_at) >
                Date.parse(
                  selectedReport.finished_at || selectedReport.created_at,
                ) : Date.parse(m.created_at) >= emptyThreadStart.current),
        )
      : sales.messages;
  async function send() {
    if (!text.trim() || disabled || uploading) return;
    const draft = text.trim();
    setText("");
    setAttachments([]);
    await sales.send(
      draft,
      attachments,
      false,
      isAnalysis && selectedReport
        ? { report_id: selectedReport.id, opportunity_id: opportunity?.id }
        : {},
    );
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    setLocalError("");
    try {
      const added: Data[] = [];
      for (const f of [...files].slice(0, 3 - attachments.length))
        added.push(await sales.upload(f));
      setAttachments((a) => [...a, ...added]);
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  }
  const onAction = (command: string, ids: string[]) =>
    void sales.command(command, { ids });
  const openAnalysisChat = () => {
    focusChat.current = true;
    setAnalysisChatOpen(true);
  };
  const closeAnalysisChat = () => {
    focusChat.current = false;
    setAnalysisChatOpen(false);
    requestAnimationFrame(() => chatTrigger.current?.focus());
  };
  const conversationPicker = (
              <select
                aria-label="Conversa"
                value={sales.conversation_id || ""}
                disabled={disabled}
                onChange={(e) => {
                  setSelectedReportId("");
                  setOpportunity(null);
                  void sales.load(restaurant, e.target.value);
                }}
                className="max-w-[170px] cursor-pointer rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel-surface)] p-2 text-sm outline-none focus-visible:border-[var(--panel-action)] disabled:cursor-not-allowed lg:hidden"
              >
                {sales.conversations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
  );
  const messageList = (
    <>
              {threadMessages.map((m) => {
                const parts =
                    m.role === "assistant"
                      ? splitMessageParts(m.content)
                      : [{ type: "text" as const, content: m.content }],
                  placed = new Set<string>(),
                  pendingIds = m.cards
                    .filter((card) => card.type === "action")
                    .map((card) => card.id)
                    .filter((id) =>
                      sales.actions.some(
                        (action) =>
                          action.id === id && action.status === "pending",
                      ),
                    );
                return (
                  <article
                    key={m.id}
                    ref={
                      m.id === sales.messages[sales.messages.length - 1]?.id
                        ? lastMessage
                        : undefined
                    }
                    className={
                      m.role === "user"
                        ? "ml-auto max-w-[85%] md:max-w-[75%]"
                        : "min-w-0"
                    }
                  >
                    <div
                      className={
                        m.role === "user"
                          ? "rounded-[18px] bg-[#e9e9e9] px-4 py-2.5"
                          : "flex items-start gap-3"
                      }
                    >
                      {m.role === "assistant" && (
                        <div
                          aria-hidden="true"
                          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--panel-tint)] text-[var(--panel-accent-text)]"
                        >
                          <Sparkles size={14} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                    {parts.map((part, i) => {
                      if (part.type === "text")
                        return (
                              <SalesMarkdown
                                key={`text-${i}`}
                                content={part.content}
                              />
                        );
                      if (part.type === "action") {
                        const actionCard = m.cards.find(
                            (card) =>
                              card.type === "action" && card.id === part.id,
                          ),
                          action = actionCard
                            ? sales.actions.find((a) => a.id === part.id)
                            : null,
                          marker = `action:${part.id}`;
                        if (!action || placed.has(marker)) return null;
                        placed.add(marker);
                        return (
                          <ActionCard
                            key={marker}
                            action={action}
                            refs={sales.references}
                            disabled={disabled}
                            onAction={onAction}
                          />
                        );
                      }
                      const marker = `card:${part.cardType}`,
                            card = m.cards.find(
                              (c) => c.type === part.cardType,
                            );
                      if (!card || placed.has(marker)) return null;
                      placed.add(marker);
                      return <DataCard key={marker} card={card} />;
                    })}
                    {m.attachments?.map((a) => (
                      <a
                        key={a.id}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 flex items-center gap-2 text-xs underline"
                      >
                        {a.mime.startsWith("image/") && (
                          <Image
                            src={a.url}
                            alt={a.name}
                            width={56}
                            height={56}
                            unoptimized
                            className="rounded-lg"
                          />
                        )}
                        {a.name}
                      </a>
                    ))}
                    {m.cards.map((card, i) => {
                      const marker =
                        card.type === "action"
                          ? `action:${card.id}`
                          : `card:${card.type}`;
                      if (placed.has(marker)) return null;
                      const action =
                        card.type === "action"
                          ? sales.actions.find((a) => a.id === card.id)
                          : null;
                      return action ? (
                        <ActionCard
                          key={i}
                          action={action}
                          refs={sales.references}
                          disabled={disabled}
                          onAction={onAction}
                        />
                      ) : card.type !== "action" ? (
                        <DataCard key={i} card={card} />
                      ) : null;
                    })}
                    {pendingIds.length > 1 && (
                      <Button
                        disabled={disabled}
                        onClick={() => {
                          setBatchIds(pendingIds);
                          setModal("batch");
                        }}
                      >
                        Revisar e aplicar todos ({pendingIds.length})
                      </Button>
                    )}
                      </div>
                    </div>
                  </article>
                );
              })}
              {(sales.busy || sales.acting || sales.running) && !analysisRunning && (
                <div role="status" className="flex justify-center py-3">
                  <div className="rounded-[10px] bg-[var(--panel-tint)] p-3">
                    <Loader />
                  </div>
                </div>
              )}
              <div ref={end} />
    </>
  );
  const notice = (
    <>
          {(sales.error || localError) && (
            <div
              role="alert"
              className="mx-4 mb-2 flex items-start justify-between gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              <span>{localError || sales.error}</span>
              <button
                aria-label="Fechar aviso"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] transition-colors hover:bg-red-100"
                onClick={() => {
                  setLocalError("");
                  sales.clearError();
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}

    </>
  );
  const composer = (
          <div className={isAnalysis ? "border-t border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" : "bg-[var(--panel-surface)] px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:px-8 md:pb-4"}>
            <div className="mx-auto max-w-3xl">
              {isAnalysis && opportunity && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-[8px] bg-[var(--panel-tint)] px-3 py-2 text-xs text-[var(--panel-accent-text)]">
                  <span className="truncate">Sobre: {opportunity.title}</span>
                  <button
                    aria-label="Remover contexto da oportunidade"
                    onClick={() => setOpportunity(null)}
                    className="p-1"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map((a) => (
                    <span
                      key={a.id}
                      className="flex items-center gap-2 rounded-lg bg-gray-100 px-2 py-1 text-xs"
                    >
                      {a.name}
                      <button
                        aria-label={`Remover ${a.name}`}
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[8px] text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-900"
                        onClick={() =>
                          setAttachments(
                            attachments.filter((x) => x.id !== a.id),
                          )
                        }
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="rounded-[16px] border border-[var(--panel-border)] bg-[var(--panel-surface)] p-2">
                <input
                  ref={file}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,application/pdf,.txt,.csv,.md"
                  onChange={(e) => void upload(e.target.files)}
                  className="hidden"
                />
                <div className="flex items-end gap-1">
                  <button
                    aria-label="Anexar arquivo"
                    disabled={uploading || disabled || attachments.length >= 3}
                    onClick={() => file.current?.click()}
                    className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Paperclip size={19} />
                  </button>
                  <textarea
                    ref={input}
                    aria-label="Mensagem para IA Vendas"
                    value={text}
                    maxLength={8000}
                    rows={1}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={
                      isAnalysis
                        ? "Pergunte sobre esta análise…"
                        : "O que podemos melhorar no seu restaurante?"
                    }
                    style={{ outline: "none" }}
                    className="max-h-40 min-h-10 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2.5 text-sm"
                  />
                  <Button
                    aria-label="Enviar mensagem"
                    disabled={!text.trim() || disabled || uploading}
                    onClick={() => void send()}
                    className="h-10 min-h-10 w-10 shrink-0 !px-0 !py-0"
                  >
                    <Send size={17} />
                  </Button>
                </div>
              </div>
              {uploading && (
                <p className="mt-2 text-center text-[11px] text-gray-400">
                  Enviando anexo…
                </p>
              )}
            </div>
          </div>
  );
  const contextualChat = (
    <div className="flex h-full min-h-0 flex-col" aria-label="Conversa sobre a análise">
      <header className="shrink-0 border-b border-[var(--panel-border)] p-4 pr-12">
        <div className="flex items-center gap-2 text-sm font-medium"><Sparkles size={16} className="text-[var(--panel-action)]" />Assistente da análise</div>
        <p className="mt-1 text-xs leading-5 text-[var(--panel-muted)]">Pergunte, entenda os dados e decida o próximo passo.</p>
        {opportunity && <div className="mt-3 rounded-[8px] bg-[var(--panel-tint)] p-3 text-xs text-[var(--panel-accent-text)]">
          <p className="font-medium">Sobre: {opportunity.title}</p>
          <button className="mt-2 cursor-pointer underline" onClick={() => setOpportunity(null)}>Ver toda a análise</button>
        </div>}
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4" aria-label="Respostas contextuais">
        {sales.has_more && <Button variant="secondary" disabled={sales.loading} onClick={() => void sales.load(restaurant, sales.conversation_id || undefined, true)}>Conversas anteriores</Button>}
        {!threadMessages.length && <div className="py-6">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--panel-tint)] text-[var(--panel-accent-text)]"><MessageSquare size={20} /></div>
          <h3 className="!text-sm">{opportunity ? "Vamos entender esta oportunidade" : "Converse sobre seu relatório"}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--panel-muted)]">{opportunity ? "Tire dúvidas sobre as evidências ou as mudanças propostas." : "As respostas ficam aqui, junto da análise que você está consultando."}</p>
          <div className="mt-4 flex flex-col items-start gap-2">
            {(opportunity ? ["Por que priorizar isso?", "Como aplicar essa mudança?"] : selectedReport ? ["Qual é a prioridade?", "Explique a estimativa"] : ["Como funciona a análise?", "O que será analisado?"]).map((question) => <Button key={question} variant="secondary" className="text-left" disabled={disabled} onClick={() => {
              setText(question);
              openAnalysisChat();
              input.current?.focus();
            }}>{question}<ArrowUpRight size={14} className="ml-2 shrink-0" /></Button>)}
          </div>
        </div>}
        {messageList}
      </div>
      {notice}
      {composer}
    </div>
  );
  return (
    <div className="h-full max-h-full min-h-0 overflow-hidden">
      <div className="flex h-full max-h-full min-h-0 overflow-hidden">
        <aside className="hidden min-h-0 w-56 shrink-0 flex-col border-r border-[var(--panel-border)] bg-[var(--panel-background)] p-3 lg:flex">
          <div>
            <p className="px-3 text-xs font-medium text-gray-500">Análises</p>
            <nav aria-label="Análises" className="mt-1 space-y-1">
              {sales.conversations
                .filter((c) => c.kind === "analysis")
                .map((c) => (
                  <button
                    key={c.id}
                    disabled={disabled}
                    aria-current={
                      c.id === sales.conversation_id ? "page" : undefined
                    }
                    onClick={() => {
                      setSelectedReportId("");
                      setOpportunity(null);
                      void sales.load(restaurant, c.id);
                    }}
                    className={`w-full cursor-pointer truncate rounded-[8px] p-3 text-left text-sm disabled:cursor-not-allowed ${c.id === sales.conversation_id ? "bg-[var(--panel-tint)] text-[var(--panel-accent-text)]" : "text-gray-600 hover:bg-[var(--panel-tint)] hover:text-[var(--panel-accent-text)]"}`}
                  >
                    ✦ Análise de vendas
                  </button>
                ))}
            </nav>
          </div>

          <div className="mt-4 flex min-h-0 flex-1 flex-col">
            <p className="px-3 text-xs font-medium text-gray-500">Conversas</p>
            <Button
              variant="secondary"
              className="mt-2"
              disabled={disabled}
              onClick={() => void sales.command("create_conversation")}
            >
              <Plus size={16} className="mr-2" />
              Nova conversa
            </Button>
            <nav
              aria-label="Conversas"
              className="mt-2 flex-1 space-y-1 overflow-y-auto"
            >
              {sales.conversations
                .filter((c) => c.kind === "chat")
                .map((c) => (
                  <div
                    key={c.id}
                    className={`group flex items-center rounded-[8px] ${c.id === sales.conversation_id ? "bg-[var(--panel-tint)] text-[var(--panel-accent-text)]" : "text-gray-600 hover:bg-[var(--panel-tint)] hover:text-[var(--panel-accent-text)]"}`}
                  >
                    <button
                      disabled={disabled}
                      aria-current={
                        c.id === sales.conversation_id ? "page" : undefined
                      }
                      onClick={() => {
                        setSelectedReportId("");
                        setOpportunity(null);
                        void sales.load(restaurant, c.id);
                      }}
                      className="min-w-0 flex-1 cursor-pointer truncate p-3 text-left text-sm disabled:cursor-not-allowed"
                    >
                      {c.title}
                    </button>
                    <div className="hidden pr-2 group-hover:flex">
                      <button
                        title="Renomear"
                        aria-label={`Renomear ${c.title}`}
                        disabled={disabled}
                        onClick={() => {
                          setRenameConversationId(c.id);
                          setRenameTitle(c.title);
                          setModal("rename");
                        }}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[8px] text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        title="Arquivar"
                        aria-label={`Arquivar ${c.title}`}
                        disabled={disabled}
                        onClick={() =>
                          void sales.command("archive_conversation", {
                            conversation_id: c.id,
                          })
                        }
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[8px] text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Archive size={12} />
                      </button>
                    </div>
                  </div>
                ))}
            </nav>
          </div>
        </aside>
        <section className="flex h-full max-h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {isAnalysis ? (
            <div className="flex min-h-0 flex-1 overflow-hidden" data-analysis-workspace>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" inert={analysisChatOpen && !wideAnalysis}>
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--panel-border)] bg-[var(--panel-surface)] px-4 py-2 lg:hidden">
                  {conversationPicker}
                  <Button variant="secondary" aria-label="Nova conversa" disabled={disabled} onClick={() => void sales.command("create_conversation")}><Plus size={16} /></Button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-[var(--panel-background)] p-4 md:p-6" aria-label="Relatório de análise">
                  {!wideAnalysis && !analysisChatOpen && notice}
                  <AnalysisReport
                    analyses={sales.analyses}
                    selected={selectedReport}
                    actions={sales.actions}
                    refs={sales.references}
                    disabled={disabled}
                    loading={sales.loading && !sales.analyses.length}
                    generating={analysisRunning}
                    status={sales.status}
                    activeOpportunityId={opportunity?.id}
                    onHistory={() => setModal("history")}
                    onSelect={(id) => {
                      setSelectedReportId(id);
                      setOpportunity(null);
                      setText("");
                    }}
                    onAction={onAction}
                    onBatch={(ids) => {
                      setBatchIds(ids);
                      setModal("batch");
                    }}
                    onDiscuss={(item) => {
                      setOpportunity(item);
                      openAnalysisChat();
                    }}
                  />
                </div>
                {!wideAnalysis && <div className="shrink-0 border-t border-[var(--panel-border)] bg-[var(--panel-surface)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                  <button ref={chatTrigger} type="button" aria-label="Pergunte sobre esta análise" aria-haspopup="dialog" aria-expanded={analysisChatOpen}
                    onClick={openAnalysisChat}
                    className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-[16px] border border-[var(--panel-border)] px-4 py-3 text-left text-sm text-[var(--panel-muted)] hover:bg-[var(--panel-background)] focus-visible:outline-2 focus-visible:outline-[var(--panel-action)]">
                    <MessageSquare size={18} className="shrink-0 text-[var(--panel-action)]" />
                    <span className="min-w-0 flex-1 truncate">{opportunity ? "Conversar sobre: " + opportunity.title : "Pergunte sobre esta análise…"}</span>
                    <ArrowUpRight size={17} className="shrink-0" />
                  </button>
                </div>}
              </div>
              {wideAnalysis && <aside className="flex min-h-0 w-[340px] shrink-0 flex-col border-l border-[var(--panel-border)] bg-[var(--panel-surface)] 2xl:w-[360px]">{contextualChat}</aside>}
              {!wideAnalysis && <Modal open={analysisChatOpen} onClose={closeAnalysisChat} height="85dvh" fixedHeight showCloseButton className="[&>.panel-modal-body]:!flex [&>.panel-modal-body]:!min-h-0 [&>.panel-modal-body]:!flex-1 [&>.panel-modal-body]:!p-0">
                {contextualChat}
              </Modal>}
            </div>
          ) : (
            <>
          <div className="flex items-center justify-between gap-2 border-b border-[var(--panel-border)] bg-[var(--panel-surface)] px-4 py-3">
            <div className="min-w-0">
              <h2 className="hidden truncate text-sm font-medium lg:block">
                {conversation?.title || "Carregando…"}
              </h2>
              {conversationPicker}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="lg:hidden"
                aria-label="Nova conversa"
                disabled={disabled}
                onClick={() => void sales.command("create_conversation")}
              >
                <Plus size={16} />
              </Button>
              <Button
                variant="secondary"
                aria-label="Histórico de ações"
                title="Histórico de ações"
                onClick={() => setModal("history")}
              >
                <History size={18} />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8">
            {sales.loading && !sales.messages.length ? <Loader /> : null}
            {!isAnalysis && sales.has_more && (
              <div className="mb-5 text-center">
                <Button
                  variant="secondary"
                  disabled={sales.loading}
                  onClick={() =>
                    void sales.load(
                      restaurant,
                      sales.conversation_id || undefined,
                      true,
                    )
                  }
                >
                  Mensagens anteriores
                </Button>
              </div>
            )}
            {!isAnalysis && !sales.messages.length && !sales.loading && (
              <div className="mx-auto flex max-w-lg flex-col items-center py-10 text-center">
                <div className="mb-5 rounded-[10px] bg-[var(--panel-tint)] p-4 text-[var(--panel-accent-text)]">
                  <Sparkles size={32} />
                </div>
                <h2 className="text-xl font-semibold">
                  O próximo passo para vender mais
                </h2>
                <p className="mt-3 text-sm leading-6 text-gray-500">
                  Encontre oportunidades nos seus pedidos, melhore seu cardápio
                  e aprove as mudanças com um clique.
                </p>
                <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                  {[
                    "Melhorar descrições",
                    "Criar uma imagem realista",
                    "Revisar preços e promoções",
                    "Configurar upsells",
                  ].map((label) => (
                    <Button
                      key={label}
                      variant="secondary"
                      onClick={() => {
                        setText(label);
                        input.current?.focus();
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="mx-auto max-w-3xl space-y-8">
              {messageList}
            </div>
          </div>
          {notice}
          {composer}
            </>
          )}

        </section>
      </div>
      <Modal
        open={modal !== null}
        onClose={() => {
          if (!sales.acting) setModal(null);
        }}
        height={modal === "rename" ? 260 : "80dvh"}
        className={modal === "rename" ? "!max-w-md" : ""}
        showCloseButton
      >
        <div className="p-5 md:p-6">
          {modal === "rename" && (
            <>
              <h2 className="text-xl font-semibold">Renomear conversa</h2>
              <form
                className="mt-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!renameTitle.trim()) return;
                  if (
                    await sales.command("rename_conversation", {
                      conversation_id: renameConversationId,
                      title: renameTitle.trim(),
                    })
                  )
                    setModal(null);
                }}
              >
                <input
                  autoFocus
                  aria-label="Nome da conversa"
                  maxLength={80}
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel-surface)] px-3 py-2.5 text-sm outline-none focus-visible:border-[var(--panel-action)]"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={sales.acting}
                    onClick={() => setModal(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    loading={sales.acting}
                    disabled={!renameTitle.trim()}
                  >
                    Salvar
                  </Button>
                </div>
              </form>
            </>
          )}
          {modal === "batch" && (
            <>
              <h2 className="text-xl font-semibold">
                Revisar todas as mudanças
              </h2>
              <p className="my-3 text-sm text-gray-500">
                Cada grupo será aplicado separadamente. Se um falhar, as
                mudanças concluídas serão preservadas.
              </p>
              <div className="space-y-5">
                {batchIds
                  .map((id) => sales.actions.find((a) => a.id === id))
                  .filter(Boolean)
                  .map((a) => (
                    <section key={a!.id}>
                      <h3 className="mb-2 font-medium">{a!.title}</h3>
                      <ActionPreview action={a!} refs={sales.references} />
                    </section>
                  ))}
              </div>
              <Button
                className="mt-5 w-full"
                loading={sales.acting}
                onClick={async () => {
                  await sales.command("apply", { ids: batchIds });
                  setModal(null);
                }}
              >
                Aplicar todos ({batchIds.length})
              </Button>
            </>
          )}
          {modal === "history" && (
            <>
              <h2 className="mb-4 text-xl font-semibold">
                Histórico desta conversa
              </h2>
              {sales.actions.length ? (
                sales.actions.map((a) => (
                  <div key={a.id}>
                    <p className="mt-4 text-xs text-gray-400">
                      {new Date(a.created_at).toLocaleString("pt-BR")}
                      {a.applied_at
                        ? ` · Aplicado em ${new Date(a.applied_at).toLocaleString("pt-BR")}`
                        : ""}
                      {a.undone_at
                        ? ` · Desfeito em ${new Date(a.undone_at).toLocaleString("pt-BR")}`
                        : ""}
                    </p>
                    <ActionCard
                      action={a}
                      refs={sales.references}
                      disabled={disabled}
                      onAction={onAction}
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  As propostas e mudanças aparecerão aqui.
                </p>
              )}
            </>
          )}
          {modal === "instructions" && (
            <>
              <h2 className="text-xl font-semibold">Contexto do restaurante</h2>
              <p className="my-3 text-sm text-gray-500">
                Conte seus objetivos, custos, margens, restrições e estilo. A IA
                considera estas informações em todas as conversas.
              </p>
              <textarea
                aria-label="Instruções do restaurante"
                rows={12}
                maxLength={12000}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full rounded-[8px] border border-[#e2e5e9] p-3 text-sm outline-none focus-visible:border-[#d93d00] focus-visible:outline-none"
              />
              <Button
                className="mt-4"
                loading={sales.acting}
                onClick={async () => {
                  if (
                    await sales.command("save_instructions", { instructions })
                  )
                    setModal(null);
                }}
              >
                Salvar contexto
              </Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
