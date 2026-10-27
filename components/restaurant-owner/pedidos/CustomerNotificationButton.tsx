"use client";
import { useEffect, useRef, useState } from "react";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { faBell, faLock } from "@fortawesome/free-solid-svg-icons";
import Tooltip from "@/components/ui/Tooltip";
import { hasQrTableAccess } from "@/lib/qr-table/types";
import { IA_PLUS_FEATURE_MESSAGE } from "@/lib/addons/products";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import IaPlusSalesModal from "@/components/restaurant-owner/ia-vendas/IaPlusSalesModal";
import { supabase } from "@/lib/database/supabaseClient";

export default function CustomerNotificationButton({orderId,restaurantId}:{orderId:string;restaurantId:string}) {
    const [busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[plusModal,setPlusModal]=useState(false);
    const [sent,setSent]=useState(false),[message,setMessage]=useState("");
    const [plus,setPlus]=useState<boolean|null>(null);
    useEffect(()=>{
        let active=true;
        setPlus(null);
        void supabase.from("restaurant_addons").select("status,current_period_ends_at")
            .eq("restaurant_id",restaurantId).eq("product_key","ia_plus").maybeSingle()
            .then(({data,error})=>{
                if(!active)return;
                if(error){setMessage("Não foi possível verificar o iMenu Plus.");return;}
                setPlus(hasQrTableAccess(data));
            });
        return ()=>{active=false;};
    },[restaurantId]);
    const inFlight=useRef(false);
    async function api(method:string,confirmed=false) {
        const {data:{session}}=await supabase.auth.getSession();
        if(!session) throw new Error("Sua sessão expirou. Entre novamente.");
        const res=await fetch("/api/orders/"+orderId+"/notify-customer",{
            method,headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
            ...(method==="POST"?{body:JSON.stringify({confirmed})}:{}),cache:"no-store"});
        const data=await res.json();
        if(!res.ok) throw new Error(data.error||"Não foi possível notificar.");
        return data;
    }
    async function notify(confirmed=false) {
        if(plus===false){setPlusModal(true);return;}
        if(plus===null||inFlight.current)return;
        inFlight.current=true;setBusy(true);setMessage("");
        try {
            if(!confirmed){
                const state=await api("GET");
                if(!state.plus){setPlusModal(true);return;}
                if(state.status){setSent(true);setMessage(state.status==="sent"?"Cliente já notificado.":"Notificação já solicitada. Confira o WhatsApp.");return;}
                if(!state.recent){setConfirm(true);return;}
            }
            const result=await api("POST",confirmed);
            if(result.confirmationRequired){setConfirm(true);return;}
            setConfirm(false);setSent(true);
            setMessage(result.sent?"Cliente notificado.":"Notificação já solicitada.");
        }catch(error){setMessage(error instanceof Error?error.message:"Não foi possível notificar.");}
        finally{inFlight.current=false;setBusy(false);}
    }
    return <>
        <Tooltip text={plus===false?IA_PLUS_FEATURE_MESSAGE:""} parentClassName="w-full" showOnClick>
        <Button variant="secondary" className="w-full gap-2" disabled={busy||sent||plus===null} loading={busy} onClick={()=>void notify()}>
            <PanelIcon icon={plus===false?faLock:faBell} className="shrink-0" aria-hidden="true"/>
            {sent?"Notificação solicitada":"Notificar Cliente (Pedido Chegou)"}
        </Button>
        </Tooltip>
        {message&&<p role="status" className="text-sm text-gray-600">{message}</p>}
        <ConfirmModal open={confirm} onClose={()=>{if(!busy)setConfirm(false);}} onConfirm={()=>void notify(true)} isLoading={busy}
            variant="primary" title="Notificar cliente?" confirmLabel="Enviar notificação"
            description="Este cliente não enviou mensagens ao WhatsApp do restaurante nos últimos 7 dias. Enviaremos um aviso de que o entregador chegou e está aguardando no local." />
        <IaPlusSalesModal contextMessage="Com o iMenu Plus, avise o cliente pelo WhatsApp quando o entregador chegar e receba a confirmação de retirada do pedido." open={plusModal} onClose={()=>setPlusModal(false)} restaurantId={restaurantId}/>
    </>;
}
