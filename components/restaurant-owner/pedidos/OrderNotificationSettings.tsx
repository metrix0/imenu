"use client";

import { CollapsibleChevron, CollapsibleContent, useCollapsible } from "@/components/ui/CollapsibleSection";

import { useState, type ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Switch from "@/components/ui/Switch";
import SaveStatus, { type SaveState } from "@/components/ui/SaveStatus";
import Tooltip from "@/components/ui/Tooltip";
import IaPlusSalesModal from "@/components/restaurant-owner/ia-vendas/IaPlusSalesModal";
import { IA_PLUS_WHATSAPP_ORDERING } from "@/lib/addons/products";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import { supabase } from "@/lib/database/supabaseClient";

export default function OrderNotificationSettings({ restaurantId, plus, initialEnabled, children, templateSaveStatus = "idle", feature = "orderNotifications" }: { restaurantId: string; plus: boolean; initialEnabled: boolean; children?: ReactNode; templateSaveStatus?: SaveState; feature?: "orderNotifications" | "ai" }) {
    const ai = feature === "ai";
    const title = ai ? IA_PLUS_WHATSAPP_ORDERING.title : "Atualizar cliente sobre pedido automaticamente";
    const descriptionId = ai ? "whatsapp-ai-description" : "order-notification-description";
    const [enabled, setEnabled] = useState(initialEnabled);
    const [sales, setSales] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(initialEnabled);
    const canExpand = !ai && Boolean(children) && plus && enabled;
    const details = useCollapsible({ open: canExpand && detailsOpen, onOpenChange: setDetailsOpen });
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
        <Card className="border border-gray-200 p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-medium text-gray-900">{title}</h2>
                        <Badge preset={plus ? "featureAvailable" : "plusIncluded"} />
                    </div>
                    <p id={descriptionId} className="mt-2 text-sm text-gray-500">
                        {ai ? IA_PLUS_WHATSAPP_ORDERING.description : "Avise quando o pedido sair para entrega ou estiver pronto no balcão. Apenas clientes que enviaram mensagens nos últimos 7 dias recebem o aviso."}
                    </p>
                    {save.status === "error" && <p role="alert" className="mt-2 text-sm text-red-600">{save.error}</p>}
                </div>
                <div className={`relative flex shrink-0 items-center gap-3 ${!ai && children ? "sm:pl-9" : ""}`}>
                    <SaveStatus status={status} />
                    <Tooltip
                        text={!plus ? (ai ? "Disponível com iMenu Plus. Assine o plano para finalizar pedidos pelo WhatsApp com IA." : "Disponível com iMenu Plus. Assine o plano para ativar as atualizações automáticas de pedidos.") : ""}
                        parentClassName="!block"
                    >
                        <Switch
                            aria-label={title}
                            aria-describedby={descriptionId}
                            checked={plus && enabled}
                            disabled={save.status === "saving"}
                            onClick={toggle}
                        />
                    </Tooltip>
                    {!ai && children && (
                        <button {...details.triggerProps}
                            aria-label={`${details.expanded ? "Recolher" : "Expandir"} mensagem automática do pedido`}
                            disabled={!canExpand}
                            className="flex h-[22px] w-6 shrink-0 cursor-pointer items-center justify-center rounded text-gray-500 disabled:cursor-not-allowed disabled:opacity-50 sm:absolute sm:left-0">
                            <CollapsibleChevron expanded={details.expanded} />
                        </button>
                    )}
                </div>
            </div>
            {!ai && children && (
                <CollapsibleContent id={details.contentId} expanded={details.expanded}>
                    <div className="pt-5">{children}</div>
                </CollapsibleContent>
            )}
            <IaPlusSalesModal
                open={sales}
                onClose={() => setSales(false)}
                restaurantId={restaurantId}
                contextMessage={ai ? "Para responder dúvidas e finalizar pedidos pelo WhatsApp com IA, assine o iMenu Plus." : "Para avisar automaticamente quando um pedido sair para entrega ou ficar pronto para retirada, assine o iMenu Plus."}
                onPaid={() => window.location.reload()}
            />
        </Card>
    );
}

