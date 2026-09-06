"use client";

import { useEffect, useId, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Dropdown from "@/components/ui/Dropdown";
import Card from "@/components/ui/Card";
import ListLoader from "@/components/ui/ListLoader";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PromotionBanner from "@/components/costumer/PromotionBanner";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTrash,
  faPen,
  faChevronDown,
  faGear,
} from "@fortawesome/free-solid-svg-icons";
import {
  WEEKDAYS,
  promotionDescription,
  validateAutomaticPromotion,
  type AutomaticPromotion,
  type PromotionRule,
  type PromotionBenefit,
  type PromotionProduct,
} from "@/lib/promotions/automatic";

const controlClass = "h-12 2xl:h-14";
const ruleOptions = [
  { value: "weekdays", label: "Dias da semana" },
  { value: "minimum", label: "Valor do pedido" },
  { value: "product", label: "Comprar produto" },
];
const benefitOptions = [
  { value: "delivery", label: "Entrega grátis" },
  { value: "percent", label: "Desconto em %" },
  { value: "fixed", label: "Desconto em R$" },
  { value: "product", label: "Produto grátis" },
];

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-6 w-10 shrink-0 rounded-full bg-gray-300 transition peer-checked:bg-green-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4"
      />
    </label>
  );
}

export default function AutomaticPromotionsPanel({
  restaurantId,
  onToast,
}: {
  restaurantId: string;
  onToast: (message: string, type: "success" | "error") => void;
}) {
  const [promotions, setPromotions] = useState<AutomaticPromotion[]>([]);
  const [products, setProducts] = useState<PromotionProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AutomaticPromotion | null>(null);
  const [deleting, setDeleting] = useState<AutomaticPromotion | null>(null);
  const [error, setError] = useState("");
  const [advancedOptions, setAdvancedOptions] = useState(false);
  const advancedOptionsId = useId();

  async function api(method: string, data?: unknown) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Sessão expirada. Entre novamente.");
    const response = await fetch(
      `/api/automatic-promotions?restaurantId=${restaurantId}`,
      {
        method,
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
      },
    );
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.error || "Não foi possível carregar as promoções.",
      );
    return result.promotions as AutomaticPromotion[];
  }

  async function load() {
    if (!restaurantId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [list, result] = await Promise.all([
        api("GET"),
        supabase
          .from("items")
          .select("id, name, price_cents, is_available")
          .eq("restaurant_id", restaurantId)
          .order("name"),
      ]);
      if (result.error) throw result.error;
      setPromotions(list);
      setProducts(result.data || []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [restaurantId]);

  async function save(promotion: AutomaticPromotion, close = false) {
    const validation = validateAutomaticPromotion(promotion);
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError("");
    try {
      setPromotions(await api("PUT", { restaurantId, promotion }));
      if (close) setEditing(null);
      onToast("Promoção salva.", "success");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao salvar.";
      setError(message);
      onToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  const create = () => {
    setError("");
    setAdvancedOptions(false);
    setEditing({
      id: crypto.randomUUID(),
      name: "",
      active: true,
      show_on_menu: false,
      delivery: true,
      mesa: false,
      allow_coupon: false,
      rules: [],
      benefits: [{ type: "delivery" }],
    });
  };
  const productOptions = [
    { value: "", label: "Selecione o produto" },
    ...products.map((p) => ({
      value: p.id,
      label: `${p.name}${p.is_available ? "" : " (pausado)"}`,
    })),
  ];
  const updateRule = (index: number, rule: PromotionRule) =>
    setEditing(
      (p) =>
        p && { ...p, rules: p.rules.map((r, i) => (i === index ? rule : r)) },
    );
  const updateBenefit = (index: number, benefit: PromotionBenefit) =>
    setEditing(
      (p) =>
        p && {
          ...p,
          benefits: p.benefits.map((r, i) => (i === index ? benefit : r)),
        },
    );
  const productPicker = (
    value: { item_id: string; quantity: number },
    onChange: (value: { item_id: string; quantity: number }) => void,
  ) => (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
      <Dropdown
        custom
        aria-label="Produto"
        options={productOptions}
        value={value.item_id}
        onChange={(e) => onChange({ ...value, item_id: e.target.value })}
        className={controlClass}
      />
      <Input
        aria-label="Quantidade"
        title="Quantidade"
        type="number"
        inputMode="numeric"
        min={1}
        max={99}
        value={value.quantity || ""}
        onChange={(e) =>
          onChange({ ...value, quantity: Number(e.target.value) })
        }
        className={controlClass}
      />
    </div>
  );

  if (loading)
    return (
      <div className="mt-6">
        <ListLoader lines={4} />
      </div>
    );
  if (loadError)
    return (
      <div className="mt-6 text-sm">
        <p>Não foi possível carregar as promoções.</p>
        <Button className="mt-3" onClick={load}>
          Tentar novamente
        </Button>
      </div>
    );

  if (editing)
    return (
      <form
        className="mx-auto mt-6 w-full max-w-3xl space-y-5 animate-fadeUp motion-reduce:animate-none"
        onSubmit={(e) => {
          e.preventDefault();
          void save(editing, true);
        }}
      >
        <fieldset disabled={saving} className="min-w-0 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">
              {promotions.some((p) => p.id === editing.id)
                ? "Editar promoção"
                : "Nova promoção"}
            </h2>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </Button>
          </div>
          <Input
            aria-label="Nome da promoção"
            label="Nome da promoção"
            placeholder="Ex.: Terça com entrega grátis"
            maxLength={80}
            required
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            className={controlClass}
          />
          <Card className="!p-4 sm:!p-5 border border-gray-200 !shadow-sm">
            <h3 className="font-semibold">Regra da promoção</h3>
            <p className="mt-1 mb-4 text-sm text-gray-500">
              Os clientes devem cumprir todas as regras adicionadas para
              receberem a promoção.
            </p>
            <div className="space-y-3">
              {editing.rules.map((rule, index) => (
                <div
                  key={index}
                  className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_2.75rem] gap-2">
                    <Dropdown
                      custom
                      aria-label={`Tipo da regra ${index + 1}`}
                      options={ruleOptions}
                      value={rule.type}
                      onChange={(e) =>
                        updateRule(
                          index,
                          e.target.value === "weekdays"
                            ? { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] }
                            : e.target.value === "minimum"
                              ? {
                                  type: "minimum",
                                  cents: 4000,
                                  comparison: "gte",
                                }
                              : { type: "product", item_id: "", quantity: 1 },
                        )
                      }
                      className={controlClass}
                    />
                    <button
                      type="button"
                      aria-label={`Remover regra ${index + 1}`}
                      onClick={() =>
                        setEditing({
                          ...editing,
                          rules: editing.rules.filter((_, i) => i !== index),
                        })
                      }
                      className="min-h-11 cursor-pointer rounded-lg text-gray-500 hover:bg-gray-200"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                  {rule.type === "weekdays" && (
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAYS.map((day, d) => (
                        <button
                          type="button"
                          key={day}
                          aria-label={day}
                          aria-pressed={rule.days.includes(d)}
                          onClick={() =>
                            updateRule(index, {
                              ...rule,
                              days: rule.days.includes(d)
                                ? rule.days.filter((v) => v !== d)
                                : [...rule.days, d],
                            })
                          }
                          className={`min-h-11 min-w-11 cursor-pointer rounded-lg border px-3 text-sm capitalize ${rule.days.includes(d) ? "border-brand bg-brand text-white" : "border-gray-200 bg-white text-gray-600"}`}
                        >
                          {day.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  )}
                  {rule.type === "minimum" && (
                    <div className="grid grid-cols-2 gap-3">
                      <Dropdown
                        custom
                        aria-label="Comparação do valor"
                        options={[
                          { value: "gte", label: "A partir de" },
                          { value: "gt", label: "Acima de" },
                        ]}
                        value={rule.comparison}
                        onChange={(e) =>
                          updateRule(index, {
                            ...rule,
                            comparison: e.target.value as "gte" | "gt",
                          })
                        }
                        className={controlClass}
                      />
                      <Input
                        aria-label="Valor mínimo em reais"
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="0.01"
                        icon="R$"
                        value={rule.cents ? rule.cents / 100 : ""}
                        onChange={(e) =>
                          updateRule(index, {
                            ...rule,
                            cents: Math.round(Number(e.target.value) * 100),
                          })
                        }
                        className={controlClass}
                      />
                    </div>
                  )}
                  {rule.type === "product" &&
                    productPicker(rule, (value) =>
                      updateRule(index, { type: "product", ...value }),
                    )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="mt-4 w-full sm:w-auto gap-2"
              disabled={editing.rules.length >= 20}
              onClick={() =>
                setEditing({
                  ...editing,
                  rules: [
                    ...editing.rules,
                    { type: "weekdays", days: [0, 1, 2, 3, 4, 5, 6] },
                  ],
                })
              }
            >
              <FontAwesomeIcon icon={faPlus} />
              Adicionar regra
            </Button>
          </Card>
          <Card className="!p-4 sm:!p-5 border border-gray-200 !shadow-sm">
            <h3 className="font-semibold">O cliente ganha</h3>
            <p className="mt-1 mb-4 text-sm text-gray-500">
              O(s) benefício(s) são aplicados uma vez por pedido.
            </p>
            <div className="space-y-3">
              {editing.benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_2.75rem] gap-2">
                    <Dropdown
                      custom
                      aria-label={`Tipo do benefício ${index + 1}`}
                      options={benefitOptions}
                      value={benefit.type}
                      onChange={(e) =>
                        updateBenefit(
                          index,
                          e.target.value === "delivery"
                            ? { type: "delivery" }
                            : e.target.value === "percent"
                              ? { type: "percent", value: 10 }
                              : e.target.value === "fixed"
                                ? { type: "fixed", cents: 500 }
                                : { type: "product", item_id: "", quantity: 1 },
                        )
                      }
                      className={controlClass}
                    />
                    <button
                      type="button"
                      aria-label={`Remover benefício ${index + 1}`}
                      onClick={() =>
                        setEditing({
                          ...editing,
                          benefits: editing.benefits.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                      className="min-h-11 cursor-pointer rounded-lg text-gray-500 hover:bg-gray-200"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                  {benefit.type === "percent" && (
                    <Input
                      aria-label="Percentual de desconto"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      max={100}
                      icon="%"
                      value={benefit.value || ""}
                      onChange={(e) =>
                        updateBenefit(index, {
                          type: "percent",
                          value: Number(e.target.value),
                        })
                      }
                      className={controlClass}
                    />
                  )}
                  {benefit.type === "fixed" && (
                    <Input
                      aria-label="Desconto em reais"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      icon="R$"
                      value={benefit.cents ? benefit.cents / 100 : ""}
                      onChange={(e) =>
                        updateBenefit(index, {
                          type: "fixed",
                          cents: Math.round(Number(e.target.value) * 100),
                        })
                      }
                      className={controlClass}
                    />
                  )}
                  {benefit.type === "product" && (
                    <>
                      {productPicker(benefit, (value) =>
                        updateBenefit(index, { type: "product", ...value }),
                      )}
                      <p className="text-xs leading-relaxed text-gray-500">
                        O cliente adiciona o produto à sacola. Complementos são
                        cobrados à parte. Na compra do mesmo produto, as
                        unidades grátis são adicionais às exigidas pela regra.
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="mt-4 w-full sm:w-auto gap-2"
              disabled={editing.benefits.length >= 20}
              onClick={() =>
                setEditing({
                  ...editing,
                  benefits: [...editing.benefits, { type: "delivery" }],
                })
              }
            >
              <FontAwesomeIcon icon={faPlus} />
              Adicionar benefício
            </Button>
          </Card>
          <Card className="!p-4 sm:!p-5 border border-gray-200 !shadow-sm space-y-2">
            <Toggle
              label="Mostrar promoção no cardápio"
              checked={editing.show_on_menu}
              onChange={(value) =>
                setEditing({ ...editing, show_on_menu: value })
              }
            />
            {editing.show_on_menu && (
              <div className="pt-2 pb-3">
                <PromotionBanner promotion={editing} products={products} />
              </div>
            )}
            <button
              type="button"
              aria-expanded={advancedOptions}
              aria-controls={advancedOptionsId}
              onClick={() => setAdvancedOptions((open) => !open)}
              className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 text-left font-semibold"
            >
              <span className="flex items-center gap-2">
                <FontAwesomeIcon icon={faGear} className="text-gray-500" />
                Configurações avançadas
              </span>
              <FontAwesomeIcon
                icon={faChevronDown}
                className={`text-xs transition-transform duration-300 motion-reduce:transition-none ${advancedOptions ? "rotate-180" : ""}`}
              />
            </button>
            <div
              id={advancedOptionsId}
              aria-hidden={!advancedOptions}
              inert={!advancedOptions}
              className={`grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out motion-reduce:transition-none ${advancedOptions ? "grid-rows-[1fr] translate-y-0 opacity-100" : "pointer-events-none grid-rows-[0fr] -translate-y-1 opacity-0"}`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="space-y-2 pt-2">
                  <Toggle
                    label="Permitir acumular com cupom"
                    checked={editing.allow_coupon}
                    onChange={(value) =>
                      setEditing({ ...editing, allow_coupon: value })
                    }
                  />
                  <p className="text-xs leading-relaxed text-gray-500">
                    Entre promoções automáticas, vale a de maior desconto. Se o
                    cupom for melhor, ele é mantido. Percentuais são calculados
                    sobre o saldo após os outros descontos. Horário de Brasília.
                  </p>
                  <div className="mt-4 border-t border-gray-200 pt-3">
                    <h3 className="mb-2 font-semibold">Ativar para</h3>
                    <Toggle
                      label="Delivery e Retirada"
                      checked={editing.delivery}
                      onChange={(value) =>
                        setEditing({ ...editing, delivery: value })
                      }
                    />
                    <Toggle
                      label="Mesa"
                      checked={editing.mesa}
                      onChange={(value) =>
                        setEditing({ ...editing, mesa: value })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-2">
              <Toggle
                label="Promoção ativa"
                checked={editing.active}
                onChange={(value) => setEditing({ ...editing, active: value })}
              />
            </div>
          </Card>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <Button
            type="submit"
            loading={saving}
            className="min-h-12 w-full sm:w-auto"
          >
            Salvar promoção
          </Button>
        </fieldset>
      </form>
    );

  return (
    <div className="mt-6 space-y-4">
      <div className="flex justify-end">
        <Button onClick={create} className="min-h-11 w-full sm:w-auto gap-2">
          <FontAwesomeIcon icon={faPlus} />
          Nova promoção
        </Button>
      </div>
      {!promotions.length && (
        <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
          <img
            src="/images/eyebrow_emoji.png"
            alt="Nenhuma promoção"
            className="mb-4 h-38 w-38"
          />
          <p className="font-medium text-gray-500">
            Nenhuma promoção criada ainda.
          </p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Crie regras e escolha os benefícios da sua primeira promoção.
          </p>
        </div>
      )}
      {promotions.map((p) => {
        const description = promotionDescription(p, products);
        return (
          <Card
            key={p.id}
            className="border border-gray-200 !shadow-sm !p-4 sm:!p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 break-words">
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {description.benefits} · {description.conditions}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                  {p.delivery && (
                    <span className="rounded-full bg-gray-100 px-2 py-1">
                      Delivery e Retirada
                    </span>
                  )}
                  {p.mesa && (
                    <span className="rounded-full bg-gray-100 px-2 py-1">
                      Mesa
                    </span>
                  )}
                  {p.show_on_menu && (
                    <span className="rounded-full bg-brand/5 px-2 py-1 text-brand">
                      Banner no cardápio
                    </span>
                  )}
                </div>
              </div>
            </div>
            <fieldset
              disabled={saving}
              className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3"
            >
              <Toggle
                label={p.active ? "Ativa" : "Pausada"}
                checked={p.active}
                onChange={(active) => {
                  void save({ ...p, active });
                }}
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  aria-label={`Editar ${p.name}`}
                  onClick={() => {
                    setError("");
                    setAdvancedOptions(false);
                    setEditing(structuredClone(p));
                  }}
                  className="min-h-11 gap-2"
                >
                  <FontAwesomeIcon icon={faPen} />
                  Editar
                </Button>
                <button
                  aria-label={`Excluir ${p.name}`}
                  onClick={() => setDeleting(p)}
                  className="min-h-11 min-w-11 cursor-pointer rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </fieldset>
          </Card>
        );
      })}
      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => {
          if (!saving) setDeleting(null);
        }}
        title="Excluir promoção?"
        description={deleting?.name}
        confirmLabel="Excluir"
        isLoading={saving}
        onConfirm={async () => {
          if (!deleting) return;
          setSaving(true);
          try {
            setPromotions(
              await api("DELETE", { restaurantId, id: deleting.id }),
            );
            setDeleting(null);
            onToast("Promoção excluída.", "success");
          } catch (e) {
            onToast(
              e instanceof Error ? e.message : "Erro ao excluir.",
              "error",
            );
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
