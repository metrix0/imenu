"use client";

import { useEffect, useState } from "react";
import DevLoading from "./DevLoading";
import { devJson } from "@/lib/dev/client";
import { formatDateTime } from "@/lib/dev/dashboardFormat";

type Message = { id:string; direction:string; body:string; model:string|null; dedupe_key?:string|null; created_at:string };

export default function SupportConversation({url,fallback}:{url:string;fallback?:string|null}) {
    const [messages,setMessages] = useState<Message[]>([]);
    const [loading,setLoading] = useState(true);
    const [error,setError] = useState("");
    useEffect(()=>{
        const controller = new AbortController();
        setLoading(true);setMessages([]);setError("");
        void devJson<{messages:Message[]}>(url,{signal:controller.signal})
            .then(result=>{if(!controller.signal.aborted)setMessages(result.messages);})
            .catch(caught=>{if(!controller.signal.aborted)setError(caught.message);})
            .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
        return ()=>controller.abort();
    },[url]);
    if(loading)return <div className="flex min-h-32 items-center justify-center"><DevLoading/></div>;
    if(error)return <p role="alert" className="text-sm text-red-700">{error}</p>;
    const visible = messages.length ? messages : fallback ? [{id:"fallback",direction:"inbound",body:fallback,model:null,created_at:""}] : [];
    return <div aria-label="Conversa" className="space-y-3 rounded-lg border border-[#d5dadf] bg-[#e9edef] p-3 sm:p-4">
        {visible.length ? visible.map(message=>{
            const incoming = message.direction === "inbound";
            return <div key={message.id} data-direction={message.direction} className={`flex ${incoming ? "justify-start" : "justify-end"}`}>
                <div className={`min-w-0 max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-6 shadow-sm ${incoming ? "rounded-tl-sm border-[#cbd5e1] bg-white" : "rounded-tr-sm border-[#9fd390] bg-[#c8efc0]"}`}>
                    <p className={`mb-1 text-xs font-semibold ${incoming ? "text-[#475569]" : "text-[#215a2c]"}`}>{incoming ? "Cliente" : message.model ? "iMenu · IA" : "iMenu"}</p>
                    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[#1d1d1d]">{message.body}</p>
                    {message.created_at && <time dateTime={message.created_at} className="mt-1 block text-right text-[11px] leading-4 text-[#626973]">{formatDateTime(message.created_at)}</time>}
                </div>
            </div>;
        }) : <p className="py-5 text-center text-sm text-gray-500">Nenhuma mensagem registrada.</p>}
    </div>;
}
