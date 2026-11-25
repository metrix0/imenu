"use client";

import ConfigurationCard from "@/components/ui/ConfigurationCard";

import { useEffect, useState } from "react";
import Image from "next/image";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import ListLoader from "@/components/ui/ListLoader";
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
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, config: { machine: value.machine } }),
        });
        if (!response.ok) throw new Error((await response.json()).error || "Não foi possível salvar a integração.");
        setConfigured(previous => ({ ifood: previous.ifood || Boolean(value.ifood.clientSecret), machine: previous.machine || Boolean(value.machine.apiKey && value.machine.password) }));
    });
    useEffect(() => {
        onSaveState(autosave.status);
    }, [autosave.status, onSaveState]);
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
    const complete = {
        machine: Boolean(config?.machine.username.trim() && config.machine.companyId.trim() && config.machine.payment &&
            (config.machine.apiKey || configured.machine) && (config.machine.password || configured.machine)),
    };
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
        <h2 className="text-xl font-semibold text-gray-900">Delivery e Parceiros</h2>
        {error && <div role="alert" className="space-y-2 text-sm text-red-600"><p>{error}</p>{!config && <Button variant="secondary" onClick={() => setLoadVersion(value => value + 1)}>Tentar novamente</Button>}</div>}
        {!config && !error && <div className="py-6" role="status" aria-label="Carregando"><ListLoader lines={3} /></div>}
        {config && <>
            <section aria-labelledby="ifood-title">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:gap-4">
                    <div className="flex min-h-12 min-w-0 flex-1 items-start gap-3 sm:gap-4">
                        <Image src="/logos/ifood.svg" alt="" width={36} height={36} className="mt-0.5 h-9 w-9 shrink-0 object-contain" />
                        <div className="min-w-0 flex-1">
                            <span id="ifood-title" className="block text-sm font-medium text-gray-900">iFood</span>
                            <span className="mt-1 block text-sm text-gray-500">Receba pedidos do iFood nos painéis do iMenu, com impressão automática quando habilitada.</span>
                        </div>
                    </div>
                    <div className="flex h-9 shrink-0 items-center self-end sm:self-auto">
                        <Badge variant="neutral">Por vir</Badge>
                    </div>
                </div>
            </section>
            <ConfigurationCard
                embedded
                collapse={{}}
                className="border-t border-gray-200 pt-6"
                title="Machine (Chama Delivery)"
                description="Solicite um entregador automaticamente ao aceitar pedidos de entrega."
                icon={<Image src="/logos/machine.svg" alt="" width={36} height={36} className="h-9 w-9 object-contain" />}
                configured={config.machine.enabled ? complete.machine : undefined}
                ariaLabel="Ativar integração Machine"
                checked={config.machine.enabled}
                disabled={!available}
                onChange={checked => change("machine", "enabled", checked)}
                footer={failures.map(failure => (
                    <div key={failure.order_id} role="alert" className="mt-4 flex flex-col gap-3 rounded-lg border border-red-200 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <p>Pedido #{failure.display_id}: {failure.state === "failed" ? failure.error : "Confira a solicitação na Machine antes de solicitar outro entregador."}</p>
                        {failure.state === "failed" && <Button variant="secondary" loading={retrying === failure.order_id} disabled={Boolean(retrying)} onClick={() => void retry(failure.order_id)}>Tentar novamente</Button>}
                    </div>
                ))}
            >
                <p className="text-sm text-gray-500">Retirada, consumo no local e pedidos importados do iFood não acionam entregadores.</p>
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
            </ConfigurationCard>
        </>}
    </Card>;
}

