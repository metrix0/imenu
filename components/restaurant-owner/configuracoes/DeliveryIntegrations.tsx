"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import Switch from "@/components/ui/Switch";
import Loader from "@/components/ui/Loader";
import type { SaveState } from "@/components/ui/SaveStatus";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import { qrTableAuthenticatedFetch } from "@/lib/qr-table/clientApi";
import type { DeliveryConfig } from "@/lib/delivery/providers";

type Failure = { order_id: string; display_id: string; state: string; error: string | null };
type Props = { restaurantId: string; onSaveState: (state: SaveState) => void };
export default function DeliveryIntegrations({ restaurantId, onSaveState }: Props) {
    const [config, setConfig] = useState<DeliveryConfig | null>(null);
    const [configured, setConfigured] = useState({ ifood: false, machine: false });
    const [available, setAvailable] = useState(false);
    const [error, setError] = useState("");
    const [failures, setFailures] = useState<Failure[]>([]);
    const [retrying, setRetrying] = useState("");
    const [loadVersion, setLoadVersion] = useState(0);
    const autosave = useAutoSave<DeliveryConfig>(restaurantId, async value => {
        const response = await qrTableAuthenticatedFetch("/api/integrations/delivery", {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, config: value }),
        });
        if (!response.ok) throw new Error((await response.json()).error || "Não foi possível salvar a integração.");
        setConfigured(previous => ({ ifood: previous.ifood || Boolean(value.ifood.clientSecret), machine: previous.machine || Boolean(value.machine.apiKey && value.machine.password) }));
    });
    useEffect(() => { onSaveState(autosave.status); }, [autosave.status, onSaveState]);
    useEffect(() => {
        let canceled = false;
        setConfig(null);
        setError("");
        void (async () => {
            try {
                const response = await qrTableAuthenticatedFetch(`/api/integrations/delivery?restaurantId=${encodeURIComponent(restaurantId)}`, { cache: "no-store" });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Não foi possível carregar as integrações.");
                if (!canceled) { setConfig(data.config); setConfigured(data.configured); setAvailable(data.available); setFailures(data.failures); }
            } catch (cause) { if (!canceled) setError(cause instanceof Error ? cause.message : "Não foi possível carregar as integrações."); }
        })();
        return () => { canceled = true; };
    }, [restaurantId, loadVersion]);
    function change(provider: "ifood" | "machine", field: string, value: string | boolean) {
        if (!config) return;
        const next = { ...config, [provider]: { ...config[provider], [field]: value } };
        setConfig(next);
        autosave.schedule(next);
    }
    async function retry(id: string) {
        setRetrying(id);
        setError("");
        try {
            const response = await qrTableAuthenticatedFetch(`/api/orders/${id}/courier`, { method: "POST" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setFailures(previous => previous.filter(item => item.order_id !== id));
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao solicitar o entregador."); }
        finally { setRetrying(""); }
    }
    return <Card className="mb-6 space-y-6 !p-5 sm:!p-7">
        <h2 className="text-xl font-semibold text-gray-900">Integrações Delivery</h2>
        {error && <div role="alert" className="space-y-2 text-sm text-red-600"><p>{error}</p>{!config && <Button variant="secondary" onClick={() => setLoadVersion(value => value + 1)}>Tentar novamente</Button>}</div>}
        {autosave.error && <p role="alert" className="text-sm text-red-600">{autosave.error}</p>}
        {!config && !error && <div className="flex justify-center py-6"><Loader /></div>}
        {config && <>
            {!available && <p className="text-sm text-gray-600">Contate o suporte para liberar as integrações Delivery.</p>}
            <section className="space-y-4" aria-labelledby="ifood-title">
                <div className="flex items-start justify-between gap-4">
                    <div><h3 id="ifood-title" className="font-semibold text-gray-900">iFood</h3>
                        <p className="mt-1 text-sm text-gray-600">Receba pedidos do iFood nos painéis do iMenu, com impressão automática quando habilitada.</p>
                        <p className="mt-1 text-sm text-gray-500">Aceite e atualize os pedidos no iFood. Alterações no iMenu ficam apenas no iMenu.</p>
                    </div>
                    <Switch aria-label="Ativar integração iFood" checked={config.ifood.enabled} disabled={!available} onClick={() => change("ifood", "enabled", !config.ifood.enabled)} />
                </div>
                <Input disabled={!available} label="ID da loja no iFood" value={config.ifood.merchantId} onChange={event => change("ifood", "merchantId", event.target.value)} />
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input disabled={!available} label="Client ID iFood" autoComplete="off" value={config.ifood.clientId} onChange={event => change("ifood", "clientId", event.target.value)} />
                    <Input disabled={!available} label="Client Secret iFood" type="password" autoComplete="new-password" placeholder={configured.ifood ? "Credencial salva" : "Informe a credencial"} value={config.ifood.clientSecret} onChange={event => change("ifood", "clientSecret", event.target.value)} />
                </div>
            </section>
            <section className="space-y-4 border-t border-gray-200 pt-6" aria-labelledby="machine-title">
                <div className="flex items-start justify-between gap-4">
                    <div><h3 id="machine-title" className="font-semibold text-gray-900">Machine (Chama Delivery)</h3>
                        <p className="mt-1 text-sm text-gray-600">Solicite um entregador automaticamente ao aceitar pedidos de entrega.</p>
                        <p className="mt-1 text-sm text-gray-500">Retirada, consumo no local e pedidos importados do iFood não acionam entregadores.</p>
                    </div>
                    <Switch aria-label="Ativar integração Machine" checked={config.machine.enabled} disabled={!available} onClick={() => change("machine", "enabled", !config.machine.enabled)} />
                </div>
                <Input disabled={!available} label="Chave API Machine" type="password" autoComplete="new-password" placeholder={configured.machine ? "Credencial salva" : "Informe a chave"} value={config.machine.apiKey} onChange={event => change("machine", "apiKey", event.target.value)} />
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input disabled={!available} label="Usuário Machine" autoComplete="off" value={config.machine.username} onChange={event => change("machine", "username", event.target.value)} />
                    <Input disabled={!available} label="Senha Machine" type="password" autoComplete="new-password" placeholder={configured.machine ? "Credencial salva" : "Informe a senha"} value={config.machine.password} onChange={event => change("machine", "password", event.target.value)} />
                    <Input disabled={!available} label="ID da empresa na Machine" inputMode="numeric" value={config.machine.companyId} onChange={event => change("machine", "companyId", event.target.value)} />
                    <Input disabled={!available} label="ID da categoria (opcional)" inputMode="numeric" value={config.machine.categoryId} onChange={event => change("machine", "categoryId", event.target.value)} />
                </div>
                <Dropdown disabled={!available} label="Pagamento do serviço de entrega" value={config.machine.payment} options={[
                    { value: "", label: "Selecione" }, { value: "F", label: "Faturado" }, { value: "R", label: "Carteira de créditos" },
                    { value: "D", label: "Dinheiro" }, { value: "B", label: "Débito" }, { value: "C", label: "Crédito" }, { value: "X", label: "Pix" },
                ]} onChange={event => change("machine", "payment", event.target.value)} />
                {failures.map(failure => <div key={failure.order_id} role="alert" className="flex flex-col gap-3 rounded-lg border border-red-200 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <p>Pedido #{failure.display_id}: {failure.state === "failed" ? failure.error : "Confira a solicitação na Machine antes de solicitar outro entregador."}</p>
                    {failure.state === "failed" && <Button variant="secondary" loading={retrying === failure.order_id} disabled={Boolean(retrying)} onClick={() => void retry(failure.order_id)}>Tentar novamente</Button>}
                </div>)}
            </section>
        </>}
    </Card>;
}
