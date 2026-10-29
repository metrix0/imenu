"use client";

import { useState, type ReactNode } from "react";
import { faCheck, faLock } from "@fortawesome/free-solid-svg-icons";
import Card from "@/components/ui/Card";
import Switch from "@/components/ui/Switch";
import SaveStatus, { type SaveState } from "@/components/ui/SaveStatus";
import Tooltip from "@/components/ui/Tooltip";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import IaPlusSalesModal from "@/components/restaurant-owner/ia-vendas/IaPlusSalesModal";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import { supabase } from "@/lib/database/supabaseClient";

export default function OrderNotificationSettings({ restaurantId, plus, initialEnabled, children, templateSaveStatus = "idle", feature = "orderNotifications" }: { restaurantId: string; plus: boolean; initialEnabled: boolean; children?: ReactNode; templateSaveStatus?: SaveState; feature?: "orderNotifications" | "ai" }) {
    const ai = feature === "ai";
    const title = ai ? "Robô com IA" : "Atualizar cliente sobre pedido automaticamente";
    const descriptionId = ai ? "whatsapp-ai-description" : "order-notification-description";
    const [enabled, setEnabled] = useState(initialEnabled);
    const [sales, setSales] = useState(false);
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
        save.schedule(next);
    };

    return (
        <Card className="border border-gray-200 p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-medium text-gray-900">{title}</h2>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${plus ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-800"}`}>
                            <FontAwesomeIcon icon={plus ? faCheck : faLock} />
                            {plus ? "Plano ativo" : "Incluso no iMenu Plus"}
                        </span>
                    </div>
                    <p id={descriptionId} className="mt-2 text-sm text-gray-500">
                        {ai ? "Responda dúvidas dos clientes com IA usando as informações do seu cardápio." : "Avise quando o pedido sair para entrega ou estiver pronto no balcão. Apenas clientes que enviaram mensagens nos últimos 7 dias recebem o aviso."}
                    </p>
                    {save.status === "error" && <p role="alert" className="mt-2 text-sm text-red-600">{save.error}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    <SaveStatus status={status} />
                    <Tooltip
                        text={!plus ? (ai ? "Disponível com iMenu Plus. Assine o plano para ativar o Robô com IA." : "Disponível com iMenu Plus. Assine o plano para ativar as atualizações automáticas de pedidos.") : ""}
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
                </div>
            </div>
            {children && (
                <div
                    className={`grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out motion-reduce:transition-none ${plus && enabled
                        ? "grid-rows-[1fr] translate-y-0 opacity-100"
                        : "pointer-events-none grid-rows-[0fr] -translate-y-1 opacity-0"}`}
                    aria-hidden={!plus || !enabled}
                    inert={!plus || !enabled}
                >
                    <div className="min-h-0 overflow-hidden">
                        <div className="pt-5">{children}</div>
                    </div>
                </div>
            )}
            <IaPlusSalesModal
                open={sales}
                onClose={() => setSales(false)}
                restaurantId={restaurantId}
                contextMessage={ai ? "Para responder dúvidas dos clientes com o Robô com IA, assine o iMenu Plus." : "Para avisar automaticamente quando um pedido sair para entrega ou ficar pronto para retirada, assine o iMenu Plus."}
                onPaid={() => window.location.reload()}
            />
        </Card>
    );
}

