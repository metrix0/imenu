"use client";

import { useState, type ReactNode } from "react";
import { faCheck, faLock } from "@fortawesome/free-solid-svg-icons";
import Card from "@/components/ui/Card";
import Switch from "@/components/ui/Switch";
import SaveStatus from "@/components/ui/SaveStatus";
import Tooltip from "@/components/ui/Tooltip";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import IaPlusSalesModal from "@/components/restaurant-owner/ia-vendas/IaPlusSalesModal";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import { supabase } from "@/lib/database/supabaseClient";

export default function OrderNotificationSettings({ restaurantId, plus, initialEnabled, children }: { restaurantId: string; plus: boolean; initialEnabled: boolean; children?: ReactNode }) {
    const [enabled, setEnabled] = useState(initialEnabled);
    const [sales, setSales] = useState(false);
    const save = useAutoSave<boolean>(restaurantId, async (value) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão expirada.");
        const response = await fetch("/api/whatsapp/settings?restaurantId=" + encodeURIComponent(restaurantId), {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
            body: JSON.stringify({ orderNotificationsEnabled: value }),
        });
        if (!response.ok) throw new Error("Não foi possível salvar.");
    });

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
                        <h2 className="text-xl font-medium text-gray-900">Atualizar cliente sobre pedido automaticamente</h2>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${plus ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-800"}`}>
                            <FontAwesomeIcon icon={plus ? faCheck : faLock} />
                            {plus ? "Plano ativo" : "Incluso no iMenu Plus"}
                        </span>
                    </div>
                    <p id="order-notification-description" className="mt-2 text-sm text-gray-500">
                        Avise quando o pedido sair para entrega ou estiver pronto no balcão. Apenas clientes que enviaram mensagens nos últimos 7 dias recebem o aviso.
                    </p>
                    {save.status === "error" && <p role="alert" className="mt-2 text-sm text-red-600">{save.error}</p>}
                </div>
                <div className="flex shrink-0 items-start gap-3">
                    {save.status === "saving" && <SaveStatus status="saving" />}
                    <Tooltip
                        text={!plus ? "Disponível com iMenu Plus. Assine o plano para ativar as atualizações automáticas de pedidos." : ""}
                        parentClassName="!block"
                    >
                        <Switch
                            aria-label="Atualizar cliente sobre pedido automaticamente"
                            aria-describedby="order-notification-description"
                            checked={plus && enabled}
                            disabled={save.status === "saving"}
                            onClick={toggle}
                        />
                    </Tooltip>
                </div>
            </div>
            {children && plus && enabled && <div className="mt-5">{children}</div>}
            <IaPlusSalesModal
                open={sales}
                onClose={() => setSales(false)}
                restaurantId={restaurantId}
                contextMessage="Para avisar automaticamente quando um pedido sair para entrega ou ficar pronto para retirada, assine o iMenu Plus."
                onPaid={() => window.location.reload()}
            />
        </Card>
    );
}
