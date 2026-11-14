"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
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
type IfoodState = {
    connected: boolean; enabled: boolean; available: boolean; merchantName: string; lastError?: string;
    pending: { userCode: string; url: string; expiresAt: number; merchants: { id: string; name: string }[] } | null;
};
export default function DeliveryIntegrations({ restaurantId, onSaveState }: Props) {
    const [config, setConfig] = useState<DeliveryConfig | null>(null);
    const [configured, setConfigured] = useState({ ifood: false, machine: false });
    const [available, setAvailable] = useState(false);
    const [error, setError] = useState("");
    const [failures, setFailures] = useState<Failure[]>([]);
    const [retrying, setRetrying] = useState("");
    const [loadVersion, setLoadVersion] = useState(0);
    const [expanded, setExpanded] = useState({ ifood: false, machine: false });
    const [ifood, setIfood] = useState<IfoodState | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [authorizationCode, setAuthorizationCode] = useState("");
    const [selectedMerchant, setSelectedMerchant] = useState("");
    const [ifoodSaveState, setIfoodSaveState] = useState<SaveState>("idle");
    const autosave = useAutoSave<DeliveryConfig>(restaurantId, async value => {
        const response = await qrTableAuthenticatedFetch("/api/integrations/delivery", {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId, config: { machine: value.machine } }),
        });
        if (!response.ok) throw new Error((await response.json()).error || "Não foi possível salvar a integração.");
        setConfigured(previous => ({ ifood: previous.ifood || Boolean(value.ifood.clientSecret), machine: previous.machine || Boolean(value.machine.apiKey && value.machine.password) }));
    });
    useEffect(() => {
        onSaveState(autosave.status === "error" || ifoodSaveState === "error" ? "error"
            : autosave.status === "saving" || ifoodSaveState === "saving" ? "saving"
            : autosave.status === "saved" || ifoodSaveState === "saved" ? "saved" : "idle");
    }, [autosave.status, ifoodSaveState, onSaveState]);
    useEffect(() => {
        let canceled = false;
        setConfig(null);
        setError("");
        void (async () => {
            try {
                const response = await qrTableAuthenticatedFetch(`/api/integrations/delivery?restaurantId=${encodeURIComponent(restaurantId)}`, { cache: "no-store" });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Não foi possível carregar as integrações.");
                if (!canceled) { setConfig(data.config); setConfigured(data.configured); setAvailable(data.available); setFailures(data.failures); setIfood(data.ifood); setExpanded(previous => ({ ...previous, ifood: Boolean(data.ifood?.pending) })); }
            } catch (cause) { if (!canceled) setError(cause instanceof Error ? cause.message : "Não foi possível carregar as integrações."); }
        })();
        return () => { canceled = true; };
    }, [restaurantId, loadVersion]);
    async function connectIfood(action: "start" | "finish" | "select" | "toggle") {
        if (connecting) return;
        if (action === "start" && !ifood?.available) {
            setError("A conexão com o iFood está indisponível. Tente novamente mais tarde.");
            return;
        }
        const popup = action === "start" ? window.open("about:blank", "_blank") : null;
        if (popup) popup.opener = null;
        setConnecting(true); setError("");
        if (action === "toggle") setIfoodSaveState("saving");
        try {
            const toggle = action === "toggle";
            const response = await qrTableAuthenticatedFetch(toggle ? "/api/integrations/delivery" : "/api/integrations/ifood/connect", {
                method: toggle ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(toggle ? { restaurantId, config: { ifood: { enabled: !ifood?.enabled } } }
                    : { restaurantId, action, authorizationCode, merchantId: selectedMerchant }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Não foi possível conectar ao iFood.");
            if (toggle) { setIfood(previous => previous && { ...previous, enabled: !previous.enabled }); setIfoodSaveState("saved"); }
            else if (action === "start") {
                const url = new URL(data.pending.url);
                if (url.origin !== "https://portal.ifood.com.br" || url.pathname !== "/apps/code") throw new Error("O iFood não retornou uma autorização válida.");
                setIfood(previous => previous && { ...previous, pending: data.pending });
                setAuthorizationCode(""); setSelectedMerchant("");
                setExpanded(previous => ({ ...previous, ifood: true }));
                if (popup) popup.location.href = url.href;
            } else {
                setIfood(previous => ({ ...data.ifood, available: previous?.available || false }));
                setSelectedMerchant("");
                if (data.ifood.connected && !data.ifood.pending) setAuthorizationCode("");
            }
        } catch (cause) {
            popup?.close();
            if (action === "toggle") setIfoodSaveState("error");
            setError(cause instanceof Error ? cause.message : "Não foi possível conectar ao iFood.");
        } finally { setConnecting(false); }
    }
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
        {!config && !error && <div className="flex justify-center py-6"><Loader /></div>}
        {config && <>
            <section aria-labelledby="ifood-title">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:gap-4">
                    <button
                        type="button"
                        aria-expanded={expanded.ifood}
                        aria-controls="ifood-integration-settings"
                        onClick={() => setExpanded(previous => ({ ...previous, ifood: !previous.ifood }))}
                        className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-start gap-3 text-left sm:gap-4"
                    >
                        <Image src="/logos/ifood.svg" alt="" width={36} height={36} className="mt-0.5 h-9 w-9 shrink-0 object-contain" />
                        <span className="min-w-0 flex-1">
                            <span id="ifood-title" className="block text-sm font-medium text-gray-900">iFood</span>
                            <span className="mt-1 block text-sm text-gray-500">Receba pedidos do iFood nos painéis do iMenu, com impressão automática quando habilitada.</span>
                        </span>
                    </button>
                    <div className="flex h-9 shrink-0 items-center gap-2 self-end sm:self-auto sm:gap-3">
                        {ifood?.connected ? <>
                            <Badge variant={ifood.enabled && !ifood.lastError ? "success" : "warning"}>{ifood.lastError ? "Verificar conexão" : ifood.enabled ? "Conectado" : "Pausado"}</Badge>
                            <Switch aria-label="Ativar integração iFood" checked={ifood.enabled} disabled={connecting} onClick={() => void connectIfood("toggle")} />
                        </> : <Button loading={connecting} disabled={!available} onClick={() => void connectIfood("start")}>Conectar iFood</Button>}
                        <button
                            type="button"
                            aria-label={`${expanded.ifood ? "Recolher" : "Expandir"} integração iFood`}
                            aria-expanded={expanded.ifood}
                            aria-controls="ifood-integration-settings"
                            onClick={() => setExpanded(previous => ({ ...previous, ifood: !previous.ifood }))}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50"
                        >
                            <FontAwesomeIcon icon={faChevronDown} style={{ width: 24, height: 24 }} className={`shrink-0 transition-transform duration-200 motion-reduce:transition-none ${expanded.ifood ? "rotate-180" : ""}`} />
                        </button>
                    </div>
                </div>
                <div
                    id="ifood-integration-settings"
                    aria-hidden={!expanded.ifood}
                    inert={!expanded.ifood}
                    className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none ${expanded.ifood ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                    <div className="min-h-0 overflow-hidden">
                        <div className="space-y-4 pt-4 sm:pl-[52px]">
                            {ifood?.connected && <p className="text-sm text-gray-600">Loja conectada: <strong>{ifood.merchantName}</strong></p>}
                            {ifood?.lastError && <p role="alert" className="text-sm text-red-600">{ifood.lastError}</p>}
                            {ifood?.connected && !ifood.pending && <Button variant="secondary" loading={connecting} onClick={() => void connectIfood("start")}>Reconectar iFood</Button>}
                            {ifood?.pending ? <form className="space-y-4" onSubmit={event => { event.preventDefault(); void connectIfood(ifood.pending?.merchants.length ? "select" : "finish"); }}>
                                {ifood.pending.merchants.length ? <Dropdown label="Loja no iFood" value={selectedMerchant} disabled={connecting}
                                    options={[{ value: "", label: "Selecione sua loja" }, ...ifood.pending.merchants.map(merchant => ({ value: merchant.id, label: merchant.name }))]}
                                    onChange={event => setSelectedMerchant(event.target.value)} /> : <>
                                    <p className="text-sm text-gray-500">Autorize o iMenu no iFood e cole abaixo o código exibido ao concluir.</p>
                                    <a href={ifood.pending.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand underline">Abrir autorização no iFood</a>
                                    <Input label="Código de autorização" autoComplete="off" value={authorizationCode} disabled={connecting} onChange={event => setAuthorizationCode(event.target.value)} />
                                </>}
                                <div className="flex flex-wrap gap-3">
                                    <Button type="submit" loading={connecting} disabled={ifood.pending.merchants.length ? !selectedMerchant : !authorizationCode.trim()}>Concluir conexão</Button>
                                    <Button type="button" variant="secondary" disabled={connecting} onClick={() => void connectIfood("start")}>Reabrir autorização</Button>
                                </div>
                            </form> : <p className="text-sm text-gray-500">{ifood?.connected ? "Aceite e atualize o preparo dos pedidos pelo iMenu." : "Clique em Conectar iFood e autorize o acesso à sua loja."}</p>}
                        </div>
                    </div>
                </div>
            </section>
            <section className="border-t border-gray-200 pt-6" aria-labelledby="machine-title">
                <div className="flex items-start gap-3 sm:gap-4">
                    <button
                        type="button"
                        aria-expanded={expanded.machine}
                        aria-controls="machine-integration-settings"
                        onClick={() => setExpanded(previous => ({ ...previous, machine: !previous.machine }))}
                        className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-start gap-3 text-left sm:gap-4"
                    >
                        <Image src="/logos/machine.svg" alt="" width={36} height={36} className="mt-0.5 h-9 w-9 shrink-0 object-contain" />
                        <span className="min-w-0 flex-1">
                            <span id="machine-title" className="block text-sm font-medium text-gray-900">Machine (Chama Delivery)</span>
                            <span className="mt-1 block text-sm text-gray-500">Solicite um entregador automaticamente ao aceitar pedidos de entrega.</span>
                        </span>
                    </button>
                    <div className="flex h-9 shrink-0 items-center gap-2 sm:gap-3">
                        {config.machine.enabled && !complete.machine && <Badge variant="warning">Não configurado</Badge>}
                        <Switch aria-label="Ativar integração Machine" checked={config.machine.enabled} disabled={!available} onClick={() => change("machine", "enabled", !config.machine.enabled)} />
                        <button
                            type="button"
                            aria-label={`${expanded.machine ? "Recolher" : "Expandir"} integração Machine`}
                            aria-expanded={expanded.machine}
                            aria-controls="machine-integration-settings"
                            onClick={() => setExpanded(previous => ({ ...previous, machine: !previous.machine }))}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50"
                        >
                            <FontAwesomeIcon icon={faChevronDown} style={{ width: 24, height: 24 }} className={`shrink-0 transition-transform duration-200 motion-reduce:transition-none ${expanded.machine ? "rotate-180" : ""}`} />
                        </button>
                    </div>
                </div>
                <div
                    id="machine-integration-settings"
                    aria-hidden={!expanded.machine}
                    inert={!expanded.machine}
                    className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none ${expanded.machine ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                    <div className="min-h-0 overflow-hidden">
                        <div className="space-y-4 pt-4 sm:pl-[52px]">
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
                        </div>
                    </div>
                </div>
                {failures.map(failure => <div key={failure.order_id} role="alert" className="mt-4 flex flex-col gap-3 rounded-lg border border-red-200 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <p>Pedido #{failure.display_id}: {failure.state === "failed" ? failure.error : "Confira a solicitação na Machine antes de solicitar outro entregador."}</p>
                    {failure.state === "failed" && <Button variant="secondary" loading={retrying === failure.order_id} disabled={Boolean(retrying)} onClick={() => void retry(failure.order_id)}>Tentar novamente</Button>}
                </div>)}
            </section>
        </>}
    </Card>;
}

