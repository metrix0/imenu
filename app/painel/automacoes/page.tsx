"use client";
import { useEffect, useRef, useState } from "react";
import PageBadge from "@/components/ui/PageBadge";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { crmRequest } from "@/lib/api/crm";
import {
  AUTOMATION_KINDS,
  AUTOMATION_LABELS,
  readAutomationSettings,
  type AutomationSettings,
  type AutomationKind,
} from "@/lib/services/crmRules";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Dropdown from "@/components/ui/Dropdown";
import Switch from "@/components/ui/Switch";
import Button from "@/components/ui/Button";
import WarningBox from "@/components/ui/WarningBox";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faArrowRight, faPlus, faRobot, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { TemplateEditor, VariablePicker, type TemplateEditorHandle, type TemplateVariable } from "@/components/ui/WhatsAppTemplateEditor";
const descriptions: Record<AutomationKind, (days: number) => string> = {
  cart: () => "Clientes com produtos no carrinho sem movimentação há pelo menos 30 minutos recebem uma mensagem no WhatsApp, com a imagem do item de maior preço quando disponível.",
  reactivation: (days) => `Clientes que não fazem pedidos há pelo menos ${days} dias recebem uma mensagem no WhatsApp.`,
  habit: () => "Clientes que fizeram pedidos no mesmo dia da semana e horário em pelo menos 3 semanas nos últimos 90 dias recebem uma mensagem 2 horas antes desse horário.",
};
const AUTOMATION_VARIABLES: TemplateVariable[] = [
  { key: "nome", label: "Nome do cliente", token: "{{nome}}", value: "Cliente" },
  { key: "restaurante", label: "Restaurante", token: "{{restaurante}}", value: "Seu restaurante" },
];
export default function AutomacoesPage() {
  const id = useCreationStore((s) => s.restaurantId);
  const [settings, setSettings] = useState<AutomationSettings | null>(null),
    [offers, setOffers] = useState<{ value: string; label: string }[]>([]),
    [connected, setConnected] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [saving, setSaving] = useState(false),
    [dirty, setDirty] = useState(false);
  const editorRefs = useRef<Record<AutomationKind, TemplateEditorHandle | null>>({ cart: null, reactivation: null, habit: null });
  const [openVariables, setOpenVariables] = useState<AutomationKind | null>(null);
  useEffect(() => {
    setSettings(null);
    setOpenVariables(null);
    setError("");
    if (!id) return;
    const controller = new AbortController();
    void crmRequest("/api/automations", id, { signal: controller.signal })
      .then((data) => {
        setSettings(data.settings);
        setOffers(data.offers);
        setConnected(data.connected);
        setDirty(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id]);
  function update(
    kind: AutomationKind,
    patch: Partial<AutomationSettings[AutomationKind]>,
  ) {
    setSettings((s) => (s ? { ...s, [kind]: { ...s[kind], ...patch } } : s));
    setDirty(true);
    setSaved(false);
  }
  async function save() {
    if (!id || !settings || saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const data = await crmRequest("/api/automations", id, {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings(data.settings);
      setSaved(true);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-20 pt-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Automações</h1>
          <p className="mt-2 text-sm text-gray-500">
            Transforme boas lembranças em novos pedidos pelo WhatsApp.
          </p>
        </div>
        <Button
          loading={saving}
          disabled={!settings || !dirty}
          onClick={() => void save()}
        >
          Salvar alterações
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-green-700">
          Automações salvas.
        </p>
      ) : null}
      {!settings && !error ? (
        <p className="text-sm text-gray-500">Carregando automações...</p>
      ) : null}
      {settings ? (
        <>
          {!connected ? (
            <WarningBox icon={faTriangleExclamation}>
              Conecte seu{" "}
              <PageBadge href="/painel/robo-whatsapp" icon={faRobot}>
                Robô WhatsApp
              </PageBadge>{" "}
              para realizar os envios. Você já pode configurar as mensagens.
            </WarningBox>
          ) : null}
          <div className="space-y-5">
            {AUTOMATION_KINDS.map((kind) => {
              const rule = settings[kind];
              return (
                <Card key={kind} className="space-y-5">
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {AUTOMATION_LABELS[kind]}
                      </h2>
                      <p className="mt-1 max-w-2xl text-sm text-gray-500">
                        {descriptions[kind](rule.days)}
                      </p>
                    </div>
                    <Switch
                      aria-label={`Ativar ${AUTOMATION_LABELS[kind]}`}
                      checked={rule.enabled}
                      onClick={() => update(kind, { enabled: !rule.enabled })}
                    />
                  </div>
                  {kind === "reactivation" ? (
                    <div className="max-w-xs">
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        label="Dias sem fazer pedidos"
                        value={rule.days}
                        onChange={(e) =>
                          update(kind, { days: Number(e.target.value) })
                        }
                      />
                    </div>
                  ) : null}
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="min-w-0">
                      <p className="mb-2 text-sm font-medium text-gray-700">Mensagem</p>
                      <TemplateEditor
                        ref={(editor) => { editorRefs.current[kind] = editor; }}
                        value={rule.message}
                        variables={AUTOMATION_VARIABLES}
                        ariaLabel={`Mensagem: ${AUTOMATION_LABELS[kind]}`}
                        onChange={(message) => update(kind, { message: message.slice(0, 1500) })}
                      />
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setOpenVariables(openVariables === kind ? null : kind)}
                          className="cursor-pointer rounded-md border border-brand/20 px-3 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          <FontAwesomeIcon icon={faPlus} className="mr-2" />
                          Adicionar variável
                        </button>
                        <button
                          type="button"
                          className="cursor-pointer text-xs font-medium text-brand underline underline-offset-2 hover:text-[#c43700] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          onClick={() => update(kind, { message: readAutomationSettings(null)[kind].message })}
                        >
                          Restaurar mensagem padrão
                        </button>
                      </div>
                      <VariablePicker
                        variables={AUTOMATION_VARIABLES}
                        open={openVariables === kind}
                        onSelect={(variable) => {
                          editorRefs.current[kind]?.insertVariable(variable);
                          setOpenVariables(null);
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <Dropdown
                        label="Promoção ou cupom (opcional)"
                        value={rule.offer}
                        onChange={(e) => update(kind, { offer: e.target.value })}
                        options={[
                          { value: "", label: "Sem oferta anexada" },
                          ...offers,
                          ...(rule.offer && !offers.some((x) => x.value === rule.offer)
                            ? [{ value: rule.offer, label: "Oferta indisponível — selecione outra" }]
                            : []),
                        ]}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">Prévia da ação</p>
                        <p className="mt-1 text-sm leading-relaxed text-gray-600">
                          {rule.offer.startsWith("coupon:")
                            ? "Ao escolher a ação, o cliente recebe o cupom e o link para aplicá-lo no cardápio."
                            : rule.offer
                              ? "Ao escolher a ação, o cliente recebe o cardápio e as regras da promoção."
                              : "Ao escolher a ação, o cliente recebe o link do cardápio."}
                        </p>
                      </div>
                      <div className="flex w-full shrink-0 items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 sm:w-auto sm:min-w-[190px]">
                        <span>{rule.offer ? "Quero a promoção" : "Ver cardápio"}</span>
                        <FontAwesomeIcon icon={faArrowRight} className="text-brand" />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
                    <span>
                      Até {rule.dailyLimit} envios por dia neste restaurante
                    </span>
                    <span>Intervalo por cliente: {rule.cooldownDays} dias</span>
                    {kind === "habit" ? <span>Horário de Brasília</span> : null}
                  </div>
                </Card>
              );
            })}
          </div>
          <p className="text-xs leading-relaxed text-gray-500">
            Somente clientes que aceitaram receber ofertas. No máximo uma
            automação por cliente a cada 24 horas. Novos pedidos impedem a
            recuperação do carrinho. Responder SAIR cancela os próximos envios.
            As respostas usam menus e ações definidas.
          </p>
        </>
      ) : null}
    </div>
  );
}
