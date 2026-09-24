"use client";
import { create } from "zustand";
import { supabase } from "@/lib/database/supabaseClient";
import type { Action, Message, Data } from "@/lib/ia-vendas/types";
async function headers(json = true) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sua sessão expirou. Entre novamente.");
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${data.session.access_token}`,
  };
}
async function api(path: string, body?: Data) {
  const r = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: await headers(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data;
}
let version = 0;
type State = {
  restaurant_id: string | null;
  conversation_id: string | null;
  conversations: Data[];
  messages: Message[];
  actions: Action[];
  instructions: string;
  analysis_available_at: string | null;
  running: Data | null;
  references: Record<string, string>;
  has_more: boolean;
  loading: boolean;
  busy: boolean;
  acting: boolean;
  status: string;
  error: string | null;
  load: (
    restaurant?: string | null,
    conversation?: string,
    older?: boolean,
  ) => Promise<void>;
  send: (text: string, attachments: Data[], deep: boolean) => Promise<void>;
  command: (command: string, extra?: Data) => Promise<any>;
  upload: (file: File) => Promise<Data>;
  clearError: () => void;
};
export const useSalesStore = create<State>((set, get) => ({
  restaurant_id: null,
  conversation_id: null,
  conversations: [],
  messages: [],
  actions: [],
  instructions: "",
  analysis_available_at: null,
  running: null,
  references: {},
  has_more: false,
  loading: false,
  busy: false,
  acting: false,
  status: "",
  error: null,
  clearError: () => set({ error: null }),
  load: async (restaurant, conversation, older = false) => {
    const request = ++version,
      previous = get();
    set({
      loading: true,
      error: null,
      ...(restaurant && restaurant !== previous.restaurant_id
        ? {
            messages: [],
            actions: [],
            conversations: [],
            instructions: "",
            references: {},
            running: null,
            conversation_id: null,
          }
        : {}),
    });
    try {
      const params = new URLSearchParams();
      const rest = restaurant || previous.restaurant_id;
      if (rest) params.set("restaurant_id", rest);
      const id =
        conversation ||
        (rest === previous.restaurant_id ? previous.conversation_id : null);
      if (id) params.set("conversation_id", id);
      if (older && previous.messages[0])
        params.set("before", previous.messages[0].created_at);
      const data = await api(`/api/ia-vendas?${params}`);
      if (request === version)
        set({
          ...data,
          messages: older
            ? [...data.messages, ...previous.messages]
            : data.messages,
          loading: false,
        });
    } catch (e) {
      if (request === version)
        set({ loading: false, error: (e as Error).message });
    }
  },
  send: async (text, attachments, deep) => {
    const current = get();
    if (current.busy || !current.conversation_id) return;
    const conversation = current.conversation_id;
    set({
      busy: true,
      error: null,
      status: "Preparando…",
      messages: [
        ...current.messages,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: text,
          cards: [],
          attachments,
          created_at: new Date().toISOString(),
        },
      ],
    });
    let error: string | null = null;
    try {
      const response = await fetch("/api/ia-vendas/chat", {
        method: "POST",
        headers: await headers(),
        body: JSON.stringify({
          restaurant_id: current.restaurant_id,
          conversation_id: conversation,
          run_id: crypto.randomUUID(),
          text,
          attachments: attachments.map((a) => a.id),
          deep,
        }),
      });
      if (!response.ok) {
        const d = await response.json();
        throw new Error(d.error);
      }
      if (!response.body) throw new Error("Conexão interrompida.");
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "",
        done = false;
      while (true) {
        const read = await reader.read();
        if (read.done) break;
        buffer += decoder.decode(read.value, { stream: true });
        let end;
        while ((end = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const event = block.match(/^event: (.+)$/m)?.[1],
            raw = block.match(/^data: (.+)$/m)?.[1];
          if (!raw) continue;
          const data = JSON.parse(raw);
          if (event === "status") set({ status: data.message });
          if (event === "error") {
            error = data.message;
            done = true;
          }
          if (event === "done") done = true;
        }
      }
      if (!done)
        error =
          "Conexão interrompida. A resposta continua no servidor; atualize em instantes.";
    } catch (e) {
      error = (e as Error).message;
    } finally {
      await get().load(current.restaurant_id, conversation);
      set({ busy: false, status: "", error });
    }
  },
  command: async (command, extra = {}) => {
    const current = get();
    set({ acting: true, error: null });
    try {
      let data: any;
      if (command === "apply" && extra.ids?.length > 1) {
        const results = [];
        for (const [i, id] of extra.ids.entries()) {
          set({ status: `Aplicando ${i + 1} de ${extra.ids.length}…` });
          const r = await api("/api/ia-vendas", {
            restaurant_id: current.restaurant_id,
            command,
            ids: [id],
          });
          results.push(...r.results);
        }
        data = { results };
      } else
        data = await api("/api/ia-vendas", {
          restaurant_id: current.restaurant_id,
          command,
          ...extra,
        });
      await get().load(
        current.restaurant_id,
        command === "create_conversation"
          ? data.id
          : command === "archive_conversation"
            ? current.conversations.find((c) => c.kind === "analysis")?.id
            : current.conversation_id || undefined,
      );
      const failed = data.results?.filter((r: Data) => !r.ok);
      if (failed?.length)
        set({ error: failed.map((r: Data) => r.error).join(" ") });
      return data;
    } catch (e) {
      set({ error: (e as Error).message });
      return null;
    } finally {
      set({ acting: false, status: "" });
    }
  },
  upload: async (file) => {
    const form = new FormData();
    form.set("file", file);
    if (get().restaurant_id) form.set("restaurant_id", get().restaurant_id!);
    const r = await fetch("/api/ia-vendas/attachments", {
      method: "POST",
      headers: await headers(false),
      body: form,
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    return data;
  },
}));
