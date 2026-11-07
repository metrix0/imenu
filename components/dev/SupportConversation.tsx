"use client";

import { Sparkles } from "lucide-react";
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
    return <div aria-label="Conversa" className="space-y-5">
        {visible.length ? visible.map(message=>{
            const incoming = message.direction === "inbound";
            return <div key={message.id} data-direction={message.direction} className={`flex ${incoming ? "justify-start" : "justify-end"}`}>
                <div className={`min-w-0 max-w-[85%] text-sm leading-6 md:max-w-[75%] ${incoming ? "rounded-[18px] bg-[#e9e9e9] px-4 py-2.5" : "flex items-start gap-3 py-1"}`}>
                    {!incoming && <div aria-hidden="true" className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff1ea] text-[#c43700]"><Sparkles size={14}/></div>}
                    <div className="min-w-0 flex-1">
                        <p className="mb-1 text-[11px] font-semibold text-gray-500">{incoming ? "Cliente" : message.model ? "iMenu · IA" : "iMenu"}</p>
                        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[#1d1d1d]">{message.body}</p>
                        {message.created_at && <time dateTime={message.created_at} className="mt-1 block text-right text-[11px] leading-4 text-[#626973]">{formatDateTime(message.created_at)}</time>}
                    </div>
                </div>
            </div>;
        }) : <p className="py-5 text-center text-sm text-gray-500">Nenhuma mensagem registrada.</p>}
    </div>;
}
