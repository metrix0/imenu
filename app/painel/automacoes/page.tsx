"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
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
import Textarea from "@/components/ui/Textarea";
import Dropdown from "@/components/ui/Dropdown";
import Switch from "@/components/ui/Switch";
import Button from "@/components/ui/Button";
const descriptions: Record<AutomationKind, string> = {
  cart: "Lembre quem deixou produtos no carrinho há pelo menos 1 hora. Inclui a imagem do item de maior valor, quando disponível.",
  reactivation:
    "Convide clientes que ficaram um período sem fazer pedidos a voltar.",
  habit:
    "Envie um lembrete 2 horas antes do horário habitual, identificado em pelo menos 3 semanas nos últimos 90 dias.",
};
export default function AutomacoesPage() {
  const id = useCreationStore((s) => s.restaurantId);
  const [settings, setSettings] = useState<AutomationSettings | null>(null),
    [offers, setOffers] = useState<{ value: string; label: string }[]>([]),
    [connected, setConnected] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [saving, setSaving] = useState(false),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    setSettings(null);
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
            <Card className="text-sm text-gray-600">
              Conecte seu{" "}
              <Link
                href="/painel/robo-whatsapp"
                className="font-medium text-brand underline"
              >
                WhatsApp
              </Link>{" "}
              para realizar os envios. Você já pode configurar as mensagens.
            </Card>
          ) : null}
          <Card className="!bg-orange-50/60 text-sm text-gray-700">
            <strong>Uma oferta faz diferença.</strong>
            <p className="mt-1">
              Recomendamos fortemente oferecer um cupom ou mencionar uma
              promoção para aumentar as chances de retorno.
            </p>
          </Card>
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
                        {descriptions[kind]}
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
                    <div>
                      <label
                        htmlFor={`message-${kind}`}
                        className="mb-2 block text-sm font-medium text-gray-700"
                      >
                        Mensagem
                      </label>
                      <Textarea
                        id={`message-${kind}`}
                        rows={4}
                        maxLength={1500}
                        value={rule.message}
                        onChange={(e) =>
                          update(kind, { message: e.target.value })
                        }
                        className="w-full resize-y rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-brand"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        Use {"{{nome}}"} e {"{{restaurante}}"} para
                        personalizar.
                      </p>
                      <button
                        type="button"
                        className="mt-2 text-xs text-brand underline"
                        onClick={() =>
                          update(kind, {
                            message: readAutomationSettings(null)[kind].message,
                          })
                        }
                      >
                        Restaurar mensagem padrão
                      </button>
                    </div>
                    <div className="space-y-4">
                      <Dropdown
                        label="Promoção ou cupom (opcional)"
                        value={rule.offer}
                        onChange={(e) =>
                          update(kind, { offer: e.target.value })
                        }
                        options={[
                          { value: "", label: "Sem oferta anexada" },
                          ...offers,
                          ...(rule.offer &&
                          !offers.some((x) => x.value === rule.offer)
                            ? [
                                {
                                  value: rule.offer,
                                  label:
                                    "Oferta indisponível — selecione outra",
                                },
                              ]
                            : []),
                        ]}
                      />
                      <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                        <p className="font-medium text-gray-900">
                          Prévia da ação
                        </p>
                        <p className="mt-2">
                          Botão:{" "}
                          <strong>
                            {rule.offer ? "Quero a promoção" : "Ver cardápio"}
                          </strong>
                        </p>
                        <p className="mt-2">
                          {rule.offer.startsWith("coupon:")
                            ? "Ao tocar, o cliente recebe o cupom e o link para aplicá-lo no cardápio."
                            : rule.offer
                              ? "Ao tocar, o cliente recebe o cardápio e as regras da promoção."
                              : "Ao tocar, o cliente recebe o link do cardápio."}
                        </p>
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
