"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
import DataTable from "@/components/ui/DataTable";
import Pagination from "@/components/ui/Pagination";
import Badge from "@/components/ui/Badge";
import Dropdown from "@/components/ui/Dropdown";
import Switch from "@/components/ui/Switch";
import SaveStatus from "@/components/ui/SaveStatus";
import Loader from "@/components/ui/Loader";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import WarningBox from "@/components/ui/WarningBox";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faPlus, faRobot, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { TemplateEditor, VariablePicker, type TemplateEditorHandle, type TemplateVariable } from "@/components/ui/WhatsAppTemplateEditor";
const descriptions: Record<AutomationKind, (days: number) => string> = {
  cart: () => "Clientes com produtos no carrinho sem movimentação há pelo menos 30 minutos recebem uma mensagem no WhatsApp, com a imagem do item de maior preço quando disponível.",
  reactivation: (days) => `Clientes que não fazem pedidos há pelo menos ${days} dias recebem uma mensagem no WhatsApp.`,
  habit: () => "Clientes que fizeram pedidos no mesmo dia da semana e horário em pelo menos 3 semanas nos últimos 90 dias recebem uma mensagem 2 horas antes desse horário.",
};
type HistoryRow = {
  id: string;
  kind: AutomationKind;
  customer_name: string;
  phone: string | null;
  offer: string | null;
  status: "sent" | "failed";
  occurred_at: string;
  demo: boolean;
};

const formattedHistoryDate = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function AutomacoesPage() {
  const id = useCreationStore((s) => s.restaurantId);
  const [settings, setSettings] = useState<AutomationSettings | null>(null),
    [offers, setOffers] = useState<{ value: string; label: string }[]>([]),
    [connected, setConnected] = useState(false),
    [restaurantName, setRestaurantName] = useState(""),
    [error, setError] = useState("");
  const { status: saveStatus, error: saveError, schedule: scheduleSave, reset: resetSave } = useAutoSave<AutomationSettings>(id, async (snapshot) => {
    if (!id) throw new Error("Restaurante não encontrado.");
    if (AUTOMATION_KINDS.some((kind) => !snapshot[kind].message.trim()))
      throw new Error("Preencha as mensagens antes de salvar automaticamente.");
    await crmRequest("/api/automations", id, {
      method: "PUT",
      body: JSON.stringify(snapshot),
    });
  });
  const editorRefs = useRef<Record<AutomationKind, TemplateEditorHandle | null>>({ cart: null, reactivation: null, habit: null });
  const [openVariables, setOpenVariables] = useState<AutomationKind | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  useEffect(() => {
    setHistoryPage(0);
  }, [id]);
  useEffect(() => {
    setHistory([]);
    setHistoryTotal(0);
    setHistoryError("");
    setHistoryLoading(Boolean(id));
    if (!id) return;
    const controller = new AbortController();
    void crmRequest(`/api/automations?history=1&page=${historyPage}`, id, { signal: controller.signal })
      .then((data: { history: HistoryRow[]; total: number }) => {
        if (!controller.signal.aborted) {
          setHistory(data.history);
          setHistoryTotal(data.total);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setHistoryError(e instanceof Error ? e.message : "Não foi possível carregar o histórico.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [id, historyPage]);
  const automationVariables = useMemo<TemplateVariable[]>(() => [
    { key: "NOME_DO_RESTAURANTE", label: "Nome do restaurante", token: "{{restaurante}}", value: restaurantName || "Restaurante" },
    { key: "NOME_DO_CLIENTE", label: "Nome do cliente", token: "{{nome}}", value: "Cliente" },
  ], [restaurantName]);
  useEffect(() => {
    setSettings(null);
    setRestaurantName("");
    setOpenVariables(null);
    setError("");
    if (!id) return;
    const controller = new AbortController();
    void crmRequest("/api/automations", id, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setSettings(data.settings);
        setOffers(data.offers);
        setConnected(data.connected);
        setRestaurantName(data.restaurantName);
        resetSave("saved");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id, resetSave]);
  function update(
    kind: AutomationKind,
    patch: Partial<AutomationSettings[AutomationKind]>,
  ) {
    if (!settings) return;
    const next = { ...settings, [kind]: { ...settings[kind], ...patch } };
    setSettings(next);
    scheduleSave(next);
  }
  if (!settings && !error) {
    return (
      <div role="status" aria-label="Carregando automações" className="flex justify-center p-10">
        <Loader className="border-t-brand" />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-20 pt-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Automações</h1>
          <p className="mt-2 text-sm text-gray-500">
            Recupere carrinhos, reative clientes e incentive novos pedidos automaticamente pelo WhatsApp.
          </p>
        </div>
        <SaveStatus status={saveStatus} className="self-start" />
      </div>
      {error || saveError ? (
        <p role="alert" className="text-sm text-red-600">
          {error || saveError}
        </p>
      ) : null}
      {settings ? (
        <>
          {!connected ? (
            <WarningBox icon={faTriangleExclamation} className="w-fit max-w-full">
              Conecte seu{" "}
              <PageBadge href="/painel/robo-whatsapp" icon={faRobot} tone="inherit" className="mx-1">
                Robô WhatsApp
              </PageBadge>{" "}
              para realizar os envios. Você já pode configurar as mensagens.
            </WarningBox>
          ) : null}
          <div className="space-y-4">
            {historyError ? <p role="alert" className="text-sm text-red-600">{historyError}</p> : null}
            <DataTable
              loading={historyLoading}
              rows={history}
              rowKey={(row) => row.id}
              emptyMessage={historyError ? "Não foi possível consultar os envios." : "Nenhum envio de automação registrado ainda."}
              columns={[
                {
                  key: "date",
                  label: "Data e hora",
                  render: (row) => <span className="whitespace-nowrap">{formattedHistoryDate(row.occurred_at)}</span>,
                },
                {
                  key: "customer",
                  label: "Cliente",
                  render: (row) => (
                    <div>
                      <p className="font-medium text-gray-900">{row.customer_name}</p>
                      {row.phone ? <p className="mt-1 text-gray-500">+{row.phone}</p> : null}
                    </div>
                  ),
                },
                { key: "kind", label: "Automação", render: (row) => AUTOMATION_LABELS[row.kind] },
                {
                  key: "offer",
                  label: "Oferta",
                  render: (row) => !row.offer ? "Sem oferta" : row.offer.startsWith("coupon:") ? "Cupom" : "Promoção",
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={row.status === "sent" ? "success" : "danger"}>
                        {row.status === "sent" ? "Enviado" : "Falhou"}
                      </Badge>
                      {row.demo ? <Badge variant="neutral">Exemplo</Badge> : null}
                    </div>
                  ),
                },
              ]}
            />
            {historyTotal > 10 ? (
              <Pagination
                page={historyPage}
                pageCount={Math.ceil(historyTotal / 10)}
                onChange={setHistoryPage}
                disabled={historyLoading}
              />
            ) : null}
          </div>
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
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="min-w-0">
                      <p className="mb-2 text-sm font-medium text-gray-700">Mensagem</p>
                      <TemplateEditor
                        ref={(editor) => { editorRefs.current[kind] = editor; }}
                        value={rule.message}
                        variables={automationVariables}
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
                        variables={automationVariables}
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
                  <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
                    <span>
                      Até {rule.dailyLimit} envios por dia neste restaurante
                    </span>
                    <span>Intervalo por cliente: {rule.cooldownDays} dias</span>
                    {kind === "reactivation" ? <span>Dias sem fazer pedidos: {rule.days}</span> : null}
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
