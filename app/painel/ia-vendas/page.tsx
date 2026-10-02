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
} from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Loader from "@/components/ui/Loader";
import { useSalesStore } from "@/lib/stores/restaurant-owner/iaVendasStore";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
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
      /(\[\[action:[0-9a-f-]{36}\]\]|\[\[card:(?:benchmark|measurement|potential)\]\])/gi,
    )
    .filter((part) => part.trim())
    .map((part) => {
      const action = /^\[\[action:([0-9a-f-]{36})\]\]$/i.exec(part);
      if (action) return { type: "action", id: action[1] };
      const card = /^\[\[card:(benchmark|measurement|potential)\]\]$/i.exec(
        part,
      );
      if (card)
        return {
          type: "card",
          cardType: card[1].toLowerCase() as
            | "benchmark"
            | "measurement"
            | "potential",
        };
      return { type: "text", content: part };
    });
}

export default function SalesPage() {
  const sales = useSalesStore(),
    restaurant = useCreationStore((s) => s.restaurantId),
    [text, setText] = useState(""),
    [attachments, setAttachments] = useState<Data[]>([]),
    [uploading, setUploading] = useState(false),
    [localError, setLocalError] = useState(""),
    [deep, setDeep] = useState(false),
    [modal, setModal] = useState<"batch" | "history" | "instructions" | null>(
      null,
    ),
    [instructions, setInstructions] = useState(""),
    [batchIds, setBatchIds] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null),
    lastMessage = useRef<HTMLElement>(null),
    previousMessages = useRef({ conversationId: "", count: 0 }),
    file = useRef<HTMLInputElement>(null),
    input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    void useSalesStore.getState().load(restaurant);
  }, [restaurant]);
  useEffect(() => {
    const previous = previousMessages.current;
    const conversationId = sales.conversation_id || "";
    const sameConversation = previous.conversationId === conversationId;
    const appended = sameConversation && sales.messages.length > previous.count;
    const last = sales.messages[sales.messages.length - 1];

    if (appended && last?.role === "assistant") {
      lastMessage.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (!sameConversation || appended) {
      end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }

    previousMessages.current = {
      conversationId,
      count: sales.messages.length,
    };
  }, [sales.messages.length, sales.conversation_id]);
  useEffect(() => {
    setText("");
    setAttachments([]);
    setDeep(false);
  }, [sales.conversation_id]);
  useEffect(() => {
    if (!input.current) return;
    input.current.style.height = "auto";
    input.current.style.height = `${input.current.scrollHeight}px`;
  }, [text]);
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
    disabled = sales.busy || sales.acting || !!sales.running;
  const pending = sales.actions.filter((a) => a.status === "pending"),
    linked = new Set(
      sales.messages.flatMap((m) =>
        m.cards.filter((c) => c.type === "action").map((c) => c.id),
      ),
    ),
    unlinked = sales.actions.filter((a) => !linked.has(a.id) && !a.message_id);
  async function send() {
    if (!text.trim() || disabled || uploading) return;
    const draft = text.trim();
    setText("");
    setAttachments([]);
    setDeep(false);
    await sales.send(draft, attachments, deep);
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
  const newAnalysis = () => {
    setDeep(true);
    setText("Faça uma análise das oportunidades de vendas do meu restaurante.");
    input.current?.focus();
  };
  return (
    <div className="h-full min-h-0">
      <div className="flex h-full min-h-0 overflow-hidden">
        <aside className="hidden min-h-0 w-56 shrink-0 flex-col border-r border-[var(--panel-border)] bg-[var(--panel-background)] p-3 lg:flex">
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => void sales.command("create_conversation")}
          >
            <Plus size={16} className="mr-2" />
            Nova conversa
          </Button>
          <nav
            aria-label="Conversas"
            className="mt-4 flex-1 space-y-1 overflow-y-auto"
          >
            {sales.conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center rounded-[8px] ${c.id === sales.conversation_id ? "bg-[var(--panel-tint)] text-[var(--panel-accent-text)]" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <button
                  disabled={disabled}
                  aria-current={c.id === sales.conversation_id ? "page" : undefined}
                  onClick={() => void sales.load(restaurant, c.id)}
                  className="min-w-0 flex-1 cursor-pointer truncate p-3 text-left text-sm disabled:cursor-not-allowed"
                >
                  {c.kind === "analysis" ? "✦ " : ""}
                  {c.title}
                </button>
                {c.kind === "chat" && (
                  <div className="flex pr-2">
                    <button
                      title="Renomear"
                      aria-label={`Renomear ${c.title}`}
                      disabled={disabled}
                      onClick={() => {
                        const title = window.prompt(
                          "Nome da conversa",
                          c.title,
                        );
                        if (title?.trim())
                          void sales.command("rename_conversation", {
                            conversation_id: c.id,
                            title,
                          });
                      }}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[8px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
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
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[8px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Archive size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </nav>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--panel-border)] bg-[var(--panel-surface)] px-4 py-3">
            <div className="min-w-0">
              <h2 className="hidden truncate text-sm font-medium lg:block">
                {conversation?.title || "Carregando…"}
              </h2>
              <select
                aria-label="Conversa"
                value={sales.conversation_id || ""}
                disabled={disabled}
                onChange={(e) => void sales.load(restaurant, e.target.value)}
                className="max-w-[170px] cursor-pointer rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel-surface)] p-2 text-sm outline-none focus-visible:border-[var(--panel-action)] disabled:cursor-not-allowed lg:hidden"
              >
                {sales.conversations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
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
            {sales.has_more && (
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
            {!sales.messages.length && !sales.loading && (
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
                  {(conversation?.kind === "analysis"
                    ? ["Analisar minhas vendas", "Como funciona a análise?"]
                    : [
                        "Melhorar descrições",
                        "Criar uma imagem realista",
                        "Revisar preços e promoções",
                        "Configurar upsells",
                      ]
                  ).map((label, i) => (
                    <Button
                      key={label}
                      variant="secondary"
                      onClick={() => {
                        if (conversation?.kind === "analysis" && i === 0)
                          newAnalysis();
                        else {
                          setText(label);
                          input.current?.focus();
                        }
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="mx-auto max-w-3xl space-y-6">
              {sales.messages.map((m) => {
                const parts =
                    m.role === "assistant"
                      ? splitMessageParts(m.content)
                      : [{ type: "text" as const, content: m.content }],
                  placed = new Set<string>();
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
                        ? "ml-auto max-w-[82%]"
                        : "min-w-0"
                    }
                  >
                    <div
                      className={
                        m.role === "user"
                          ? "rounded-[10px] bg-[var(--panel-accent-text)] px-4 py-3 text-white [&_.text-brand]:!text-white [&_.text-gray-700]:!text-white [&_.text-gray-950]:!text-white"
                          : "flex items-start gap-3"
                      }
                    >
                      {m.role === "assistant" && (
                        <div
                          aria-hidden="true"
                          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--panel-tint)] text-[var(--panel-accent-text)]"
                        >
                          <Sparkles size={16} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        {m.role === "assistant" && (
                          <p className="mb-2 text-xs font-medium text-[var(--panel-accent-text)]">
                            iMenu IA Vendas
                          </p>
                        )}
                    {parts.map((part, i) => {
                      if (part.type === "text")
                        return (
                          <SalesMarkdown key={`text-${i}`} content={part.content} />
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
                        card = m.cards.find((c) => c.type === part.cardType);
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
                      </div>
                    </div>
                  </article>
                );
              })}
              {unlinked.map((a) => (
                <ActionCard
                  key={a.id}
                  action={a}
                  refs={sales.references}
                  disabled={disabled}
                  onAction={onAction}
                />
              ))}
              {pending.length > 1 && (
                <Button
                  disabled={disabled}
                  onClick={() => {
                    setBatchIds(pending.map((a) => a.id));
                    setModal("batch");
                  }}
                >
                  Revisar e aplicar todos ({pending.length})
                </Button>
              )}
              {(sales.busy || sales.acting || sales.running) && (
                <p
                  role="status"
                  className="flex items-center gap-2 py-3 text-sm text-gray-500"
                >
                  <Sparkles size={16} className="animate-pulse" />
                  {sales.status || "Processamento em andamento…"}
                </p>
              )}
              <div ref={end} />
            </div>
          </div>
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
          <div className="bg-[var(--panel-surface)] px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:px-8 md:pb-4">
            <div className="mx-auto max-w-3xl">
              {deep && (
                <div className="mb-2 flex items-center justify-between rounded-[8px] bg-[var(--panel-tint)] px-3 py-2 text-xs text-[var(--panel-accent-text)]">
                  <span>
                    Análise completa · pedidos, cardápio e oportunidades
                  </span>
                  <button
                    aria-label="Cancelar análise completa"
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[8px] transition-colors hover:bg-black/5"
                    onClick={() => setDeep(false)}
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
              <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel-surface)] p-2 transition-[border-color] focus-within:border-[var(--panel-action)]">
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
                    placeholder="O que podemos melhorar no seu restaurante?"
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
        </section>
      </div>
      <Modal
        open={modal !== null}
        onClose={() => {
          if (!sales.acting) setModal(null);
        }}
        height="80dvh"
        showCloseButton
      >
        <div className="p-5 md:p-6">
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
