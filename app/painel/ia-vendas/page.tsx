"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Sparkles,
  Plus,
  Send,
  Paperclip,
  History,
  Settings2,
  X,
  Pencil,
  Archive,
  RefreshCw,
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
    file = useRef<HTMLInputElement>(null),
    input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    void useSalesStore.getState().load(restaurant);
  }, [restaurant]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [sales.messages.length, sales.busy]);
  useEffect(() => {
    setText("");
    setAttachments([]);
    setDeep(false);
  }, [sales.conversation_id]);
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
    <div className="p-4 md:p-0">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
            <Sparkles className="text-[#D93D00]" size={25} />
            IA Vendas
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Seu cardápio pode vender mais. Vamos descobrir como.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            aria-label="Histórico de ações"
            title="Histórico de ações"
            onClick={() => setModal("history")}
          >
            <History size={18} />
          </Button>
          <Button
            variant="secondary"
            aria-label="Contexto do restaurante"
            title="Contexto do restaurante"
            onClick={() => {
              setInstructions(sales.instructions);
              setModal("instructions");
            }}
          >
            <Settings2 size={18} />
          </Button>
        </div>
      </header>
      <div className="flex h-[calc(100dvh-190px)] min-h-[520px] overflow-hidden rounded-[10px] border border-[#e2e5e9] bg-white md:h-[calc(100dvh-160px)]">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-gray-200 bg-gray-50/60 p-3 lg:flex">
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
                className={`group flex items-center rounded-lg ${c.id === sales.conversation_id ? "bg-orange-50 text-[#D93D00]" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <button
                  disabled={disabled}
                  onClick={() => void sales.load(restaurant, c.id)}
                  className="min-w-0 flex-1 truncate p-3 text-left text-sm"
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
                      className="p-1"
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
                      className="p-1"
                    >
                      <Archive size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </nav>
          <p className="px-2 pt-4 text-xs leading-5 text-gray-400">
            Você aprova cada mudança antes de publicar.
          </p>
        </aside>
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <div className="min-w-0">
              <h2 className="hidden truncate text-sm font-medium lg:block">
                {conversation?.title || "Carregando…"}
              </h2>
              <select
                aria-label="Conversa"
                value={sales.conversation_id || ""}
                disabled={disabled}
                onChange={(e) => void sales.load(restaurant, e.target.value)}
                className="max-w-[170px] rounded-lg border border-gray-200 p-2 text-sm lg:hidden"
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
              {conversation?.kind === "analysis" && (
                <Button
                  variant="secondary"
                  disabled={disabled}
                  onClick={newAnalysis}
                >
                  Nova análise
                </Button>
              )}
              <button
                aria-label="Atualizar conversa"
                disabled={sales.busy || sales.acting}
                onClick={() => void sales.load(restaurant)}
                className="p-2 text-gray-400"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8">
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
                <div className="mb-5 rounded-2xl bg-orange-50 p-4 text-[#D93D00]">
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
              {sales.messages.map((m) => (
                <article
                  key={m.id}
                  className={
                    m.role === "user"
                      ? "ml-auto max-w-[90%] rounded-[10px] bg-gray-100 px-4 py-3"
                      : "min-w-0"
                  }
                >
                  {m.role === "assistant" && (
                    <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#D93D00]">
                      <Sparkles size={14} />
                      iMenu IA Vendas
                    </p>
                  )}
                  <SalesMarkdown content={m.content} />
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
                </article>
              ))}
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
                onClick={() => {
                  setLocalError("");
                  sales.clearError();
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="border-t border-gray-100 p-4 md:px-8">
            <div className="mx-auto max-w-3xl">
              {deep && (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-orange-50 px-3 py-2 text-xs text-[#D93D00]">
                  <span>
                    Análise completa · pedidos, cardápio e oportunidades
                  </span>
                  <button
                    aria-label="Cancelar análise completa"
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
              <div className="rounded-[10px] border border-gray-200 p-2 focus-within:border-[#D93D00]">
                <textarea
                  ref={input}
                  aria-label="Mensagem para IA Vendas"
                  value={text}
                  maxLength={8000}
                  rows={2}
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
                  className="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none"
                />
                <div className="flex items-center justify-between">
                  <input
                    ref={file}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf,.txt,.csv,.md"
                    onChange={(e) => void upload(e.target.files)}
                    className="hidden"
                  />
                  <button
                    aria-label="Anexar arquivo"
                    disabled={uploading || disabled || attachments.length >= 3}
                    onClick={() => file.current?.click()}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                  >
                    <Paperclip size={19} />
                  </button>
                  <Button
                    aria-label="Enviar mensagem"
                    disabled={!text.trim() || disabled || uploading}
                    onClick={() => void send()}
                  >
                    <Send size={17} />
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-center text-[11px] text-gray-400">
                {uploading
                  ? "Enviando anexo…"
                  : "Confira as propostas antes de aplicar. Você pode desfazer as mudanças."}
              </p>
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
                APLICAR TODOS ({batchIds.length})
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
                className="w-full rounded-lg border border-gray-200 p-3 text-sm outline-[#D93D00]"
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
