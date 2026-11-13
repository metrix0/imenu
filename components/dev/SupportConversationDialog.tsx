"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { devJson } from "@/lib/dev/client";
import type { Conversation } from "@/lib/dev/supportTypes";
import DevDialog from "./DevDialog";
import SupportConversation from "./SupportConversation";

export type SupportConversationTarget = Pick<Conversation, "id" | "mode"> &
    Partial<Pick<Conversation, "restaurant_name" | "customer_name">>;

export type ActiveSupportConversation = {
    conversation: SupportConversationTarget | null;
    description?: string;
    onSent?: () => void;
};

export default function SupportConversationDialog({
    active,
    onClose,
}: {
    active: ActiveSupportConversation | null;
    onClose: () => void;
}) {
    const [reply, setReply] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [requestId, setRequestId] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        setReply("");
        setError("");
        setRequestId(null);
        setRevision(0);
    }, [active?.conversation?.id, active?.description]);

    async function sendReply() {
        const conversation = active?.conversation;
        if (!conversation || conversation.mode !== "human" || !reply.trim() || sending) return;

        const id = requestId || window.crypto.randomUUID();
        setRequestId(id);
        setError("");
        setSending(true);
        try {
            await devJson("/api/dev/support/drafts", {
                method: "POST",
                body: JSON.stringify({
                    id: conversation.id,
                    action: "send_human_message",
                    text: reply.trim(),
                    requestId: id,
                }),
            });
            setReply("");
            setRequestId(null);
            setRevision(value => value + 1);
            active?.onSent?.();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Não foi possível enviar a mensagem.");
        } finally {
            setSending(false);
        }
    }

    return <DevDialog
        title="Conversa"
        description={active?.description || active?.conversation?.restaurant_name || active?.conversation?.customer_name || undefined}
        open={Boolean(active)}
        onClose={() => { if (!sending) onClose(); }}
    >
        {active && <div className="space-y-5 p-5 sm:p-6">
            {active.conversation
                ? <SupportConversation key={active.conversation.id + ":" + revision} url={"/api/dev/support/drafts?conversation_id=" + active.conversation.id} scrollToBottomOnLoad />
                : <p className="py-5 text-center text-sm text-gray-500">Nenhuma conversa registrada.</p>}
            {active.conversation?.mode === "human" && <>
                <div>
                    <label htmlFor="support-human-reply" className="mb-2 block text-sm font-medium">Resposta</label>
                    <Textarea
                        id="support-human-reply"
                        value={reply}
                        maxLength={8000}
                        rows={4}
                        disabled={sending}
                        placeholder="Digite sua resposta..."
                        className="w-full resize-y rounded-lg border border-[#e2e5e9] bg-white p-3 text-sm focus:border-[#d93d00] focus:outline-none"
                        onChange={event => { setReply(event.target.value); setRequestId(null); }}
                    />
                </div>
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                <Button leftIcon={<Send size={16} aria-hidden="true" />} loading={sending} disabled={!reply.trim() || sending}
                    onClick={() => void sendReply()}>Enviar mensagem</Button>
            </>}
        </div>}
    </DevDialog>;
}
