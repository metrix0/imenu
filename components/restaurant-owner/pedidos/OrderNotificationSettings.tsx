"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import Switch from "@/components/ui/Switch";
import SaveStatus from "@/components/ui/SaveStatus";
import Button from "@/components/ui/Button";
import IaPlusSalesModal from "@/components/restaurant-owner/ia-vendas/IaPlusSalesModal";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import { supabase } from "@/lib/database/supabaseClient";
export default function OrderNotificationSettings({restaurantId,plus,initialEnabled}:{restaurantId:string;plus:boolean;initialEnabled:boolean}) {
    const [enabled,setEnabled]=useState(initialEnabled),[sales,setSales]=useState(false);
    const save=useAutoSave<boolean>(restaurantId,async(value)=>{
        const {data:{session}}=await supabase.auth.getSession();
        if(!session)throw new Error("Sessão expirada.");
        const response=await fetch("/api/whatsapp/settings?restaurantId="+encodeURIComponent(restaurantId),{
            method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
            body:JSON.stringify({orderNotificationsEnabled:value})});
        if(!response.ok)throw new Error("Não foi possível salvar.");
    });
    return <Card className="border border-gray-200 p-7">
        <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-lg font-semibold text-gray-900">Atualizar cliente sobre pedido automaticamente</h2>
                <p className="mt-1 text-sm text-gray-600">Avise quando o pedido sair para entrega ou estiver pronto no balcão. Apenas clientes que enviaram mensagens nos últimos 7 dias recebem o aviso.</p></div>
            <Switch aria-label="Atualizar cliente sobre pedido automaticamente" checked={plus&&enabled} disabled={!plus}
                onClick={()=>{const next=!enabled;setEnabled(next);save.schedule(next);}} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-brand">iMenu Plus</span>
            {!plus?<Button variant="secondary" onClick={()=>setSales(true)}>Desbloquear com iMenu Plus</Button>:<SaveStatus status={save.status}/>}
        </div>
        {save.status==="error"&&<p role="alert" className="mt-2 text-sm text-red-600">{save.error}</p>}
        <IaPlusSalesModal open={sales} onClose={()=>setSales(false)} restaurantId={restaurantId} onPaid={()=>window.location.reload()}/>
    </Card>;
}
