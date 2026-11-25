"use client";

import ConfigurationCard from "@/components/ui/ConfigurationCard";


import { useState, type ReactNode } from "react";
import SaveStatus, { type SaveState } from "@/components/ui/SaveStatus";
import IaPlusSalesModal from "@/components/restaurant-owner/ia-vendas/IaPlusSalesModal";
import { IA_PLUS_WHATSAPP_ORDERING } from "@/lib/addons/products";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import { supabase } from "@/lib/database/supabaseClient";

export default function OrderNotificationSettings({ restaurantId, plus, initialEnabled, children, templateSaveStatus = "idle", feature = "orderNotifications" }: { restaurantId: string; plus: boolean; initialEnabled: boolean; children?: ReactNode; templateSaveStatus?: SaveState; feature?: "orderNotifications" | "ai" }) {
    const ai = feature === "ai";
    const title = ai ? IA_PLUS_WHATSAPP_ORDERING.title : "Atualizar cliente sobre pedido automaticamente";
    const [enabled, setEnabled] = useState(initialEnabled);
    const [sales, setSales] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(initialEnabled);
    const canExpand = !ai && Boolean(children) && plus && enabled;
    const save = useAutoSave<boolean>(restaurantId, async (value) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão expirada.");
        const response = await fetch("/api/whatsapp/settings?restaurantId=" + encodeURIComponent(restaurantId), {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
            body: JSON.stringify({ [ai ? "aiEnabled" : "orderNotificationsEnabled"]: value }),
        });
        if (!response.ok) throw new Error("Não foi possível salvar.");
    });

    const status: SaveState = save.status === "error" || templateSaveStatus === "error" ? "error"
        : save.status === "saving" || templateSaveStatus === "saving" ? "saving"
        : save.status === "saved" || templateSaveStatus === "saved" ? "saved" : "idle";

    const toggle = () => {
        if (!plus) {
            setSales(true);
            return;
        }
        const next = !enabled;
        setEnabled(next);
        setDetailsOpen(next);
        save.schedule(next);
    };

    return (
        <>
            <ConfigurationCard
                title={title}
                plus={plus}
                description={ai ? IA_PLUS_WHATSAPP_ORDERING.description : "Avise quando o pedido sair para entrega ou estiver pronto no balcão. Apenas clientes que enviaram mensagens nos últimos 7 dias recebem o aviso."}
                checked={plus && enabled}
                disabled={save.status === "saving"}
                onChange={toggle}
                toggleTooltip={!plus ? (ai ? "Disponível com iMenu Plus. Assine o plano para finalizar pedidos pelo WhatsApp com IA." : "Disponível com iMenu Plus. Assine o plano para ativar as atualizações automáticas de pedidos.") : undefined}
                collapse={!ai && children ? { open: canExpand && detailsOpen, onOpenChange: setDetailsOpen, disabled: !canExpand } : undefined}
                footer={<>
                    {save.status === "error" && <p role="alert" className="mt-2 text-sm text-red-600">{save.error}</p>}
                    <SaveStatus status={status} />
                </>}
            >
                {!ai && children}
            </ConfigurationCard>
            <IaPlusSalesModal
                open={sales}
                onClose={() => setSales(false)}
                restaurantId={restaurantId}
                contextFeature={ai ? "whatsapp_ai" : "order_notifications"}
                contextMessage={ai ? "Para responder dúvidas e finalizar pedidos pelo WhatsApp com IA, assine o iMenu Plus." : "Para avisar automaticamente quando um pedido sair para entrega ou ficar pronto para retirada, assine o iMenu Plus."}
                onPaid={() => window.location.reload()}
            />
        </>
    );
}

