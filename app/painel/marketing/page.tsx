"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import PageBadge from "@/components/ui/PageBadge";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { crmRequest } from "@/lib/api/crm";
import {
  AUTOMATION_KINDS,
  AUTOMATION_LABELS,
  readAutomationSettings,
  MAX_AUTOMATION_DAILY_LIMIT,
  type AutomationSettings,
  type AutomationKind,
} from "@/lib/services/crmRules";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import DataTable from "@/components/ui/DataTable";
import Pagination from "@/components/ui/Pagination";
import Badge from "@/components/ui/Badge";
import RecommendedBadge from "@/components/ui/RecommendedBadge";
import Dropdown from "@/components/ui/Dropdown";
import Switch from "@/components/ui/Switch";
import SaveStatus from "@/components/ui/SaveStatus";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import Image from "next/image";
import IaPlusSalesModal from "@/components/restaurant-owner/ia-vendas/IaPlusSalesModal";
import { IA_PLUS_FEATURE_MESSAGE, IA_PLUS_PRICE_LABEL } from "@/lib/addons/products";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import WarningBox from "@/components/ui/WarningBox";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faPlus, faRobot, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { ArrowRight, CalendarClock, ShoppingCart, UserRoundCheck } from "lucide-react";
import { TemplateEditor, VariablePicker, type TemplateEditorHandle, type TemplateVariable } from "@/components/ui/WhatsAppTemplateEditor";
const descriptions: Record<AutomationKind, (days: number) => string> = {
  cart: () => "Clientes com produtos no carrinho sem movimentação há pelo menos 30 minutos recebem uma mensagem no WhatsApp, com a imagem do item de maior preço quando disponível.",
  reactivation: (days) => `Clientes que não fazem pedidos há pelo menos ${days} dias recebem uma mensagem no WhatsApp.`,
  habit: () => "Clientes que fizeram pedidos no mesmo dia da semana e horário em pelo menos 3 semanas nos últimos 90 dias recebem uma mensagem 2 horas antes desse horário.",
};
const cardOrder: AutomationKind[] = ["habit", "reactivation", "cart"];

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

export default function MarketingPage() {
  const id = useCreationStore((s) => s.restaurantId);
  const [plus, setPlus] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [settings, setSettings] = useState<AutomationSettings | null>(null),
    [offers, setOffers] = useState<{ value: string; label: string }[]>([]),
    [connected, setConnected] = useState(false),
    [restaurantName, setRestaurantName] = useState(""),
    [dailyLimitDraft, setDailyLimitDraft] = useState("10"),
    [error, setError] = useState("");
  const { status: saveStatus, error: saveError, schedule: scheduleSave, reset: resetSave } = useAutoSave<AutomationSettings>(id, async (snapshot) => {
    if (!plus) throw new Error(IA_PLUS_FEATURE_MESSAGE);
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
    setPlus(false);
    setRestaurantName("");
    setDailyLimitDraft("10");
    setOpenVariables(null);
    setError("");
    if (!id) return;
    const controller = new AbortController();
    void crmRequest("/api/automations", id, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setSettings(data.settings);
        setPlus(data.plus === true);
        setOffers(data.offers);
        setConnected(data.connected);
        setRestaurantName(data.restaurantName);
        setDailyLimitDraft(String(data.settings.dailyTotalLimit));
        resetSave(data.plus ? "saved" : "idle");
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
    if (!settings || !plus) return;
    const next = { ...settings, [kind]: { ...settings[kind], ...patch } };
    setSettings(next);
    scheduleSave(next);
  }
  function updateDailyLimit(total: number) {
    if (!settings || !plus || total === settings.dailyTotalLimit) return;
    const next = { ...settings, dailyTotalLimit: total };
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
          <h1 className="text-3xl font-bold text-gray-900">Automações de Marketing WhatsApp</h1>
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
      <div className="relative">
      <div
        inert={!plus}
        aria-hidden={!plus}
        className={`space-y-6 ${!plus ? "pointer-events-none select-none opacity-30 saturate-50" : ""}`}
      >
      {settings ? (
        <>
          {!connected ? (
            <WarningBox icon={faTriangleExclamation} className="w-fit max-w-full">
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span>Conecte seu</span>
                <PageBadge href="/painel/robo-whatsapp" icon={faRobot} tone="inherit">
                  Robô WhatsApp
                </PageBadge>
                <span>para realizar os envios. Você já pode configurar as mensagens.</span>
              </span>
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
            {cardOrder.map((kind) => {
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
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium leading-[18px] text-[#1d1d1d]">
                          Promoção ou cupom (opcional)
                        </span>
                        {kind !== "cart" ? <RecommendedBadge /> : null}
                      </div>
                      <Dropdown
                        aria-label="Promoção ou cupom (opcional)"
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
                    <span>Intervalo por cliente: {rule.cooldownDays} dias</span>
                    {kind === "reactivation" ? <span>Dias sem fazer pedidos: {rule.days}</span> : null}
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
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Limite diário de mensagens</h2>
              <Badge variant="warning">Não recomendado</Badge>
            </div>
            <p className="max-w-3xl text-sm leading-relaxed text-gray-600">
              As três automações compartilham este limite diário por restaurante.
              Aumentar o limite pode elevar o risco de restrições ou bloqueio do número pelo WhatsApp.
            </p>
            <div className="max-w-xs">
              <Input
                label="Máximo total de mensagens por dia"
                type="number"
                min={1}
                max={MAX_AUTOMATION_DAILY_LIMIT}
                step={1}
                value={dailyLimitDraft}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!/^\d{0,4}$/.test(value)) return;
                  setDailyLimitDraft(value);
                  const total = Number(value);
                  if (value !== "" && total >= 1 && total <= MAX_AUTOMATION_DAILY_LIMIT) {
                    updateDailyLimit(total);
                  }
                }}
                onBlur={() => {
                  const total = Number(dailyLimitDraft);
                  if (!dailyLimitDraft || !Number.isInteger(total) || total < 1 || total > MAX_AUTOMATION_DAILY_LIMIT) {
                    setDailyLimitDraft(String(settings.dailyTotalLimit));
                  }
                }}
              />
            </div>
          </Card>
        </>
      ) : null}
      </div>
      {!plus && settings ? (
        <div className="absolute inset-x-0 top-10 z-10 flex justify-center px-3 sm:top-20">
          <Card className="w-full max-w-xl overflow-hidden border border-gray-200 !p-0 text-left shadow-xl">
            <div className="p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative h-9 w-40 max-w-full">
                  <Image
                    src="/logos/PlusCombinationMarkLogo_Brand.png"
                    alt="iMenu Plus"
                    fill
                    sizes="160px"
                    className="object-contain object-left"
                  />
                </div>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-brand">
                  Marketing pelo WhatsApp
                </span>
              </div>
              <h2 className="mt-5 text-2xl font-bold leading-tight text-gray-900">
                Traga seus clientes de volta, no momento certo
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Automatize o contato com quem demonstrou interesse e incentive novos pedidos sem enviar cada mensagem manualmente.
              </p>
              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-brand">
                    <ShoppingCart size={20} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Recupere carrinhos abandonados</h3>
                    <p className="mt-1 text-sm leading-5 text-gray-600">
                      Lembre quem deixou itens no carrinho, com imagem do produto quando disponível.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-brand">
                    <UserRoundCheck size={20} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Reative clientes inativos</h3>
                    <p className="mt-1 text-sm leading-5 text-gray-600">
                      Convide de volta quem está há dias sem pedir, com cupom ou promoção opcional.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-brand">
                    <CalendarClock size={20} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Aproveite hábitos de compra</h3>
                    <p className="mt-1 text-sm leading-5 text-gray-600">
                      Envie um lembrete antes dos dias e horários em que seus clientes costumam comprar.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 rounded-lg bg-orange-50/60 px-4 py-3">
                <p className="text-sm leading-5 text-gray-700">
                  <strong>Você no controle:</strong> personalize as mensagens, escolha ofertas e acompanhe os envios no histórico.
                </p>
              </div>
              <Button
                type="button"
                className="mt-6 w-full gap-2"
                onClick={() => setPlusOpen(true)}
              >
                Conhecer iMenu Plus
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
              <p className="mt-3 text-center text-xs text-gray-500">
                Incluído no iMenu Plus · {IA_PLUS_PRICE_LABEL}/mês
              </p>
            </div>
          </Card>
        </div>
      ) : null}
      </div>
      {id ? <IaPlusSalesModal open={plusOpen} onClose={() => setPlusOpen(false)} restaurantId={id} contextMessage="Para criar automações de WhatsApp, recuperar carrinhos e reativar clientes, assine o iMenu Plus." onPaid={() => window.location.reload()} /> : null}
    </div>
  );
}
