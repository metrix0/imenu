"use client";
import Image from "next/image";
import type { ReactNode } from "react";
import { ArrowUpRight, ChevronDown, Lock, TrendingUp } from "lucide-react";
import styles from "./AnalysisReport.module.css";
import Button from "@/components/ui/Button";
import Tooltip from "@/components/ui/Tooltip";
import { IA_PLUS_FEATURE_MESSAGE } from "@/lib/addons/products";
import type { Action, Data, Operation } from "@/lib/ia-vendas/types";
const labels: Record<string, string> = {
  name: "Nome",
  description: "Descrição",
  price_cents: "Preço",
  image_path: "Imagem",
  logo_url: "Logo",
  banner_url: "Banner",
  category_id: "Categoria",
  item_id: "Produto",
  item_subcategory_id: "Grupo de complementos",
  position: "Posição",
  is_available: "Disponível",
  stock_enabled: "Controle de estoque",
  stock_quantity: "Estoque",
  type: "Tipo",
  value: "Desconto",
  active: "Ativo",
  is_active: "Ativo",
  starts_at: "Início",
  ends_at: "Término",
  code: "Código",
  discount_type: "Tipo de desconto",
  discount_value: "Desconto",
  max_discount_value: "Desconto máximo",
  min_order_value: "Pedido mínimo",
  quantity: "Quantidade",
  unlimited_quantity: "Quantidade ilimitada",
  start_date: "Data inicial",
  end_date: "Data final",
  available_days: "Dias disponíveis",
  start_time: "Hora inicial",
  end_time: "Hora final",
  origins: "Canais",
  show_coupon: "Mostrar cupom",
  one_coupon_per_user: "Uma utilização por cliente",
  goal_count: "Meta de pedidos",
  reward_description: "Descrição da recompensa",
  min_order_value_cents: "Pedido mínimo",
  reward_item_id: "Recompensa",
  reward_subitem_ids: "Complementos da recompensa",
  min_select: "Seleção mínima",
  max_select: "Seleção máxima",
  allow_multiple_units: "Permitir várias unidades",
  url_slug: "Link público",
  min_order_cents: "Pedido mínimo",
  availability_json: "Horários",
  is_closed: "Fechamento manual até",
  pickup_enabled: "Retirada",
  allowed_payment_methods: "Formas de pagamento",
  prep_time_min_minutes: "Preparo mínimo (min)",
  prep_time_max_minutes: "Preparo máximo (min)",
  prep_time_source: "Origem do prazo",
  force_whatsapp_order_confirmation: "Confirmação por WhatsApp",
  allow_future_order_scheduling: "Agendamento",
  delivery_fee_mode: "Cálculo da entrega",
  delivery_fee_json: "Taxas por raio",
  delivery_neighborhood_fee_json: "Taxas por bairro",
  automatic_promotions: "Promoções automáticas",
  pizza_settings: "Configuração de pizza",
  message_templates: "Mensagens do WhatsApp",
  is_enabled: "Ativado",
  ga4_id: "Google Analytics",
  gtm_id: "Google Tag Manager",
  meta_pixel_id: "Meta Pixel",
  radius_km: "Raio (km)",
  fee_cents: "Taxa",
  time_minutes: "Prazo (min)",
  enabled: "Ativado",
  pricing_rule: "Regra de preço",
  max_flavors: "Máximo de sabores",
  category_ids: "Categorias",
  same_category_only: "Mesma categoria",
  open: "Abre",
  close: "Fecha",
  rules: "Regras",
  benefits: "Benefícios",
  show_on_menu: "Mostrar no cardápio",
  delivery: "Entrega",
  mesa: "Mesa",
  allow_coupon: "Permite cupom",
  days: "Dias",
  cents: "Valor",
  neighborhood: "Bairro",
  city: "Cidade",
  state: "Estado",
  aliases: "Nomes alternativos",
  comparison: "Comparação",
};
const entities: Record<string, string> = {
  restaurants: "Configuração da loja",
  categories: "Categoria",
  items: "Produto",
  item_subcategories: "Grupo de complementos",
  subitems: "Complemento",
  upsell: "Upsell",
  promotions: "Promoção",
  coupons: "Cupom",
  loyalty_programs: "Fidelidade",
  restaurant_tables: "Mesa",
  tracking_integrations: "Rastreamento",
  whatsapp_bot_settings: "WhatsApp",
  menu: "Cardápio",
};
const values: Record<string, string> = {
  percent: "Percentual",
  fixed: "Valor fixo",
  delivery: "Entrega",
  retirada: "Retirada",
  autoatendimento: "Mesa",
  pix: "Pix",
  dinheiro: "Dinheiro",
  "trazer-maquininha": "Maquininha",
  radius: "Por raio",
  neighborhood: "Por bairro",
  highest: "Maior valor",
  average: "Média",
  manual: "Manual",
  product: "Produto",
  weekdays: "Dias da semana",
  minimum: "Pedido mínimo",
  gte: "Maior ou igual",
  gt: "Maior que",
};
const templateLabels: Record<string, string> = {
  welcome: "Boas-vindas",
  menu_link: "Link do cardápio",
  delivery: "Entrega",
  payment: "Pagamento",
  order_status_found: "Status do pedido",
  handoff: "Atendimento humano",
  order_tracking: "Acompanhamento do pedido",
  status_notification: "Atualização de status",
};
export const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
function display(
  k: string,
  v: any,
  refs: Record<string, string>,
  op?: Data,
): string {
  if (v == null || v === "") return "Não definido";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number") {
    if (k === "position") return `${v + 1}°`;
    if (
      k.includes("cents") ||
      k === "cents" ||
      (k === "value" &&
        op?.entity === "promotions" &&
        op?.values?.type === "fixed")
    )
      return money(v);
    if (k === "discount_value" && op?.values?.discount_type === "percent")
      return `${v * 100}%`;
    if (["max_discount_value", "min_order_value", "discount_value"].includes(k))
      return money(v * 100);
    if (k === "value" && op?.values?.type === "percent") return `${v}%`;
    return String(v);
  }
  if (Array.isArray(v)) {
    if (k === "available_days")
      return v.map((day) => weekdayNames[Number(day)] || String(day)).join(", ");
    if (["allowed_payment_methods", "origins"].includes(k))
      return v.map((value) => values[String(value)] || String(value)).join(", ");
    if (["reward_subitem_ids", "category_ids"].includes(k))
      return v.map((value) => refs[String(value)] || String(value)).join(", ");
    return v.map((x) => display("", x, refs)).join("\n");
  }
  if (typeof v === "object") {
    if (k === "message_templates")
      return Object.entries(v)
        .map(
          ([key, value]) =>
            `${templateLabels[key] || key}: ${String(value ?? "Não definido")}`,
        )
        .join("\n\n");
    return Object.entries(v)
      .map(
        ([key, value]) => `${labels[key] || key}: ${display(key, value, refs)}`,
      )
      .join("\n");
  }
  if (["start_date", "end_date"].includes(k) && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) {
    const [year, month, day] = String(v).split("-");
    return `${day}/${month}/${year}`;
  }
  if (k === "is_closed") {
    const match = String(v).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}`;
  }
  if (["starts_at", "ends_at"].includes(k)) {
    const date = new Date(String(v));
    if (!Number.isNaN(date.getTime()))
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      }).format(date);
  }
  if (["start_time", "end_time"].includes(k))
    return String(v).slice(0, 5);
  return refs[v] || values[v] || String(v);
}

function subject(op: Operation, refs: Record<string, string>) {
  const merged = { ...(op.before || {}), ...op.values };
  const relatedItem =
    ["upsell", "promotions"].includes(op.entity) && merged.item_id
      ? refs[merged.item_id]
      : null;
  return String(
    relatedItem ||
      refs[op.id] ||
      merged.name ||
      merged.code ||
      (op.label !== op.entity ? op.label : "") ||
      entities[op.entity] ||
      op.label,
  );
}

function strong(text: string): ReactNode {
  return <strong className="font-semibold text-gray-900">{text}</strong>;
}

const weekdayNames = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function scheduleSlots(value: unknown, day: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const slots = (value as Record<string, unknown>)[String(day)];
  return Array.isArray(slots)
    ? slots
        .filter(
          (slot): slot is { open: string; close: string } =>
            !!slot &&
            typeof slot === "object" &&
            typeof (slot as Data).open === "string" &&
            typeof (slot as Data).close === "string",
        )
        .map((slot) => `${slot.open}–${slot.close}`)
    : [];
}

function feeLabel(cents: unknown) {
  return money(typeof cents === "number" ? cents : 0);
}

function deliveryRow(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Data;
  if (!Number.isFinite(Number(row.radius_km))) return null;
  return {
    key: String(row.radius_km),
    label: `Até ${Number(row.radius_km).toLocaleString("pt-BR")} km`,
    value: `${feeLabel(row.fee_cents)} · ${Number(row.time_minutes) || 0} min`,
  };
}

function neighborhoodRow(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Data;
  if (!row.neighborhood) return null;
  const location = [row.neighborhood, row.city, row.state].filter(Boolean).join(" · ");
  return {
    key: [row.neighborhood, row.city, row.state].filter(Boolean).join("|"),
    label: location,
    value: `${feeLabel(row.fee_cents)} · ${Number(row.time_minutes) || 0} min`,
  };
}

function listChangeSummary(
  previous: unknown,
  next: unknown,
  parser: (value: unknown) => { key: string; label: string; value: string } | null,
): ReactNode {
  const before = new Map(
    (Array.isArray(previous) ? previous : [])
      .map(parser)
      .filter((row): row is { key: string; label: string; value: string } => !!row)
      .map((row) => [row.key, row]),
  );
  const after = new Map(
    (Array.isArray(next) ? next : [])
      .map(parser)
      .filter((row): row is { key: string; label: string; value: string } => !!row)
      .map((row) => [row.key, row]),
  );
  const keys = [...new Set([...before.keys(), ...after.keys()])];
  const changes = keys.flatMap((key) => {
    const oldRow = before.get(key),
      newRow = after.get(key);
    if (oldRow?.value === newRow?.value) return [];
    if (!oldRow && newRow)
      return [{ key, label: newRow.label, text: `Adicionar ${newRow.value}.` }];
    if (oldRow && !newRow)
      return [{ key, label: oldRow.label, text: "Remover." }];
    return [{
      key,
      label: newRow?.label || oldRow?.label || key,
      text: `${oldRow?.value || "Não definido"} → ${newRow?.value || "Não definido"}.`,
    }];
  });
  if (!changes.length) return <>Nenhuma alteração.</>;
  return (
    <span className="space-y-1">
      {changes.map(({ key, label, text }) => (
        <span key={key} className="block">
          {strong(label)}: {text}
        </span>
      ))}
    </span>
  );
}

function promotionRule(rule: Data, refs: Record<string, string>) {
  if (rule.type === "weekdays")
    return `dias: ${(Array.isArray(rule.days) ? rule.days : [])
      .map((day: unknown) => weekdayNames[Number(day)] || String(day))
      .join(", ")}`;
  if (rule.type === "minimum")
    return `${rule.comparison === "gt" ? "acima de" : "a partir de"} ${money(Number(rule.cents) || 0)}`;
  if (rule.type === "product")
    return `${Number(rule.quantity) || 0}× ${refs[String(rule.item_id)] || "produto"}`;
  return "regra";
}

function promotionBenefit(benefit: Data, refs: Record<string, string>) {
  if (benefit.type === "delivery") return "entrega grátis";
  if (benefit.type === "percent") return `${Number(benefit.value) || 0}% de desconto`;
  if (benefit.type === "fixed") return `${money(Number(benefit.cents) || 0)} de desconto`;
  if (benefit.type === "product")
    return `${Number(benefit.quantity) || 0}× ${refs[String(benefit.item_id)] || "produto"} grátis`;
  return "benefício";
}

function promotionText(value: Data, refs: Record<string, string>) {
  const channels = [
    value.delivery ? "Delivery" : "",
    value.mesa ? "Mesa" : "",
  ].filter(Boolean);
  const rules = (Array.isArray(value.rules) ? value.rules : [])
    .map((rule) => promotionRule(rule as Data, refs))
    .join("; ");
  const benefits = (Array.isArray(value.benefits) ? value.benefits : [])
    .map((benefit) => promotionBenefit(benefit as Data, refs))
    .join("; ");
  return [
    value.active ? "Ativa" : "Inativa",
    channels.length ? channels.join(" e ") : "Sem canal",
    value.show_on_menu ? "visível no cardápio" : "oculta no cardápio",
    value.allow_coupon ? "aceita cupom" : "não aceita cupom",
    rules ? `Regras: ${rules}` : "Sem regras",
    benefits ? `Benefícios: ${benefits}` : "Sem benefícios",
  ].join(" · ");
}

function promotionsChangeSummary(
  previous: unknown,
  next: unknown,
  refs: Record<string, string>,
): ReactNode {
  const rows = (value: unknown) =>
    new Map(
      (Array.isArray(value) ? value : [])
        .filter((row): row is Data => !!row && typeof row === "object" && !Array.isArray(row))
        .map((row) => [String(row.id || row.name), row]),
    );
  const before = rows(previous),
    after = rows(next),
    keys = [...new Set([...before.keys(), ...after.keys()])];
  const changes = keys.flatMap((key) => {
    const oldRow = before.get(key),
      newRow = after.get(key);
    if (oldRow && newRow && JSON.stringify(oldRow) === JSON.stringify(newRow))
      return [];
    const label = String(newRow?.name || oldRow?.name || "Promoção");
    if (!oldRow && newRow)
      return [{ key, label, text: `Adicionar: ${promotionText(newRow, refs)}.` }];
    if (oldRow && !newRow)
      return [{ key, label, text: "Remover promoção." }];
    return [{
      key,
      label,
      text: `${promotionText(oldRow || {}, refs)} → ${promotionText(newRow || {}, refs)}.`,
    }];
  });
  if (!changes.length) return <>Nenhuma alteração.</>;
  return (
    <span className="space-y-1">
      {changes.map(({ key, label, text }) => (
        <span key={key} className="block">
          {strong(label)}: {text}
        </span>
      ))}
    </span>
  );
}

function pizzaChangeSummary(
  previous: unknown,
  next: unknown,
  refs: Record<string, string>,
): ReactNode {
  const before = previous && typeof previous === "object" && !Array.isArray(previous) ? previous as Data : {};
  const after = next && typeof next === "object" && !Array.isArray(next) ? next as Data : {};
  const fields = [
    ["enabled", "Pizza com vários sabores"],
    ["max_flavors", "Máximo de sabores"],
    ["pricing_rule", "Regra de preço"],
    ["same_category_only", "Somente mesma categoria"],
    ["category_ids", "Categorias"],
  ] as const;
  const changes = fields.flatMap(([field, label]) => {
    if (JSON.stringify(before[field]) === JSON.stringify(after[field])) return [];
    return [{
      field,
      label,
      before: display(field, before[field], refs),
      after: display(field, after[field], refs),
    }];
  });
  if (!changes.length) return <>Nenhuma alteração.</>;
  return (
    <span className="space-y-1">
      {changes.map(({ field, label, before: oldValue, after: newValue }) => (
        <span key={field} className="block">
          {strong(label)}: {oldValue} → {newValue}.
        </span>
      ))}
    </span>
  );
}

function messageTemplatesChangeSummary(previous: unknown, next: unknown): ReactNode {
  const before = previous && typeof previous === "object" && !Array.isArray(previous) ? previous as Data : {};
  const after = next && typeof next === "object" && !Array.isArray(next) ? next as Data : {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const changes = keys.filter((key) => before[key] !== after[key]);
  if (!changes.length) return <>Nenhuma alteração.</>;
  return (
    <>
      Atualizar {changes.map((key) => templateLabels[key] || key).join(", ")}.
    </>
  );
}

function scheduleChangeSummary(previous: unknown, next: unknown): ReactNode {
  const changes = weekdayNames.flatMap((day, index) => {
    const before = scheduleSlots(previous, index);
    const after = scheduleSlots(next, index);
    if (JSON.stringify(before) === JSON.stringify(after)) return [];

    const added = after.filter((slot) => !before.includes(slot));
    const removed = before.filter((slot) => !after.includes(slot));
    let text: string;
    if (added.length && !removed.length)
      text = `Adicionar ${added.join(", ")}.`;
    else if (removed.length && !added.length)
      text = `Remover ${removed.join(", ")}.`;
    else if (!after.length)
      text = "Sem atendimento.";
    else
      text = `${before.length ? before.join(", ") : "Sem atendimento"} → ${after.join(", ")}.`;

    return [{ day, text }];
  });

  if (!changes.length) return <>Nenhuma alteração de horário.</>;
  return (
    <span className="space-y-1">
      {changes.map(({ day, text }) => (
        <span key={day} className="block">
          {strong(day)}: {text}
        </span>
      ))}
    </span>
  );
}

function operationCopy(
  op: Operation,
  refs: Record<string, string>,
): { heading: string; summary: ReactNode; hideDetails: boolean } {
  const name = subject(op, refs);
  const headingEntity =
    op.entity === "items" ? "Item" : entities[op.entity] || op.label;
  const heading = `${op.kind === "create" ? "Adicionar" : op.kind === "delete" ? "Excluir" : "Editar"} ${headingEntity}`;

  if (op.entity === "upsell") {
    if (op.kind === "delete")
      return {
        heading,
        summary: <>Remover {strong(name)} das sugestões do carrinho.</>,
        hideDetails: true,
      };
    const position = op.values.position ?? op.before?.position;
    return {
      heading,
      summary: (
        <>
          Sugerir {strong(name)} como complemento no carrinho
          {Number.isFinite(Number(position)) ? (
            <span className="text-gray-500">
              {" "}
              (Posição: {Number(position) + 1}°)
            </span>
          ) : null}
          .
        </>
      ),
      hideDetails: true,
    };
  }

  if (op.kind === "delete")
    return {
      heading,
      summary: <>Excluir {strong(name)}.</>,
      hideDetails: true,
    };

  if (op.kind === "create")
    return {
      heading,
      summary: (
        <>
          Criar {(entities[op.entity] || "registro").toLowerCase()}{" "}
          {strong(name)}.
        </>
      ),
      hideDetails: false,
    };

  const entries = Object.entries(op.values);
  if (entries.length !== 1)
    return {
      heading,
      summary: <>Atualizar {strong(name)}.</>,
      hideDetails: false,
    };

  const [field, next] = entries[0];
  const previous = op.before?.[field];

  if (field === "availability_json")
    return {
      heading: "Editar Horários",
      summary: scheduleChangeSummary(previous, next),
      hideDetails: true,
    };
  if (field === "delivery_fee_json")
    return {
      heading: "Editar Taxas por raio",
      summary: listChangeSummary(previous, next, deliveryRow),
      hideDetails: true,
    };
  if (field === "delivery_neighborhood_fee_json")
    return {
      heading: "Editar Taxas por bairro",
      summary: listChangeSummary(previous, next, neighborhoodRow),
      hideDetails: true,
    };
  if (field === "automatic_promotions")
    return {
      heading: "Editar Promoções automáticas",
      summary: promotionsChangeSummary(previous, next, refs),
      hideDetails: true,
    };
  if (field === "pizza_settings")
    return {
      heading: "Editar Configuração de pizza",
      summary: pizzaChangeSummary(previous, next, refs),
      hideDetails: true,
    };
  if (field === "message_templates")
    return {
      heading: "Editar Mensagens do WhatsApp",
      summary: messageTemplatesChangeSummary(previous, next),
      hideDetails: false,
    };

  if (field === "name")
    return {
      heading,
      summary: (
        <>
          Renomear {strong(name)} para {strong(String(next))}.
        </>
      ),
      hideDetails: true,
    };
  if (field === "price_cents")
    return {
      heading,
      summary: (
        <>
          Alterar o preço de {strong(name)} de{" "}
          {display(field, previous, refs, op)} para{" "}
          {display(field, next, refs, op)}.
        </>
      ),
      hideDetails: true,
    };
  if (field === "position")
    return {
      heading,
      summary: (
        <>
          Mover {strong(name)} da posição {display(field, previous, refs, op)} para{" "}
          {display(field, next, refs, op)}.
        </>
      ),
      hideDetails: true,
    };
  if (field === "category_id") {
    const category = refs[String(next)] || display(field, next, refs, op);
    return {
      heading,
      summary: (
        <>
          Mover {strong(name)} para a categoria {strong(category)}.
        </>
      ),
      hideDetails: true,
    };
  }
  if (field === "is_available")
    return {
      heading,
      summary: (
        <>
          Marcar {strong(name)} como {next ? "disponível" : "indisponível"}.
        </>
      ),
      hideDetails: true,
    };

  return {
    heading: `Editar ${labels[field] || headingEntity}`,
    summary: <>{strong(name)}</>,
    hideDetails: false,
  };
}

export function ActionPreview({
  action,
  refs = {},
  showAllDetails = false,
  flat = false,
}: {
  action: Action;
  refs?: Record<string, string>;
  showAllDetails?: boolean;
  flat?: boolean;
}) {
  const GroupHeading = flat ? "h4" : "div";
  const visibleOperations = action.operations.filter((op) => {
      const fields = Object.keys(op.values);
      return !(
        action.image &&
        fields.length === 1 &&
        ["image_path", "logo_url", "banner_url"].includes(fields[0])
      );
    }),
    operationGroups = Array.from(
      visibleOperations
        .reduce((groups, op) => {
          const key = `${op.kind}:${op.entity}`,
            current = groups.get(key);
          if (current) current.push(op);
          else groups.set(key, [op]);
          return groups;
        }, new Map<string, Operation[]>())
        .values(),
    ),
    groupedEntities: Record<string, string> = {
      categories: "Categorias",
      items: "Itens",
      item_subcategories: "Grupos de complementos",
      subitems: "Complementos",
      promotions: "Promoções",
      coupons: "Cupons",
      restaurant_tables: "Mesas",
    };

  const groupHeading = (op: Operation, count: number) => {
    if (op.entity === "upsell" && op.kind === "create")
      return `${showAllDetails ? "Adicionar ofertas no carrinho" : "Adicionar Upsell"} (${count})`;
    const entity = groupedEntities[op.entity];
    if (!entity) return `${operationCopy(op, refs).heading} (${count})`;
    const verb =
      op.kind === "create" ? "Adicionar" : op.kind === "delete" ? "Excluir" : "Editar";
    return `${verb} ${entity} (${count})`;
  };

  const details = (op: Operation) => {
    const copy = operationCopy(op, refs);
    if (op.kind === "delete" || copy.hideDetails) return null;
    return (
      <dl className="mt-2 space-y-1.5 text-xs">
        {Object.entries(op.values)
          .filter(
            ([k]) =>
              !action.image ||
              !["image_path", "logo_url", "banner_url"].includes(k),
          )
          .map(([k, v]) => (
            <div key={k} className="flex min-w-0 flex-wrap gap-x-1 py-0.5">
              <dt className="font-medium text-gray-700">
                {labels[k] || k}:
              </dt>
              {op.kind === "create" ? (
                <dd className="min-w-0 whitespace-pre-wrap break-words text-gray-900">
                  {display(k, v, refs, op)}
                </dd>
              ) : (
                <dd className="min-w-0 whitespace-pre-wrap break-words text-gray-700">
                  <span className="sr-only">Antes: </span>
                  <span className="text-gray-500">
                    {display(k, op.before?.[k], refs, op)}
                  </span>
                  <span aria-hidden="true"> → </span>
                  <span className="sr-only">Depois: </span>
                  <span className="text-gray-900">
                    {display(k, v, refs, op)}
                  </span>
                </dd>
              )}
            </div>
          ))}
      </dl>
    );
  };

  return (
    <div className={flat ? styles.flatOperations : "space-y-2"}>
      {action.image && (
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Antes", action.image.before],
            ["Depois", action.image.after],
          ].map(([label, url]) => (
            <figure key={label}>
              <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                {url ? (
                  <Image
                    src={url}
                    alt={`${label}: ${action.title}`}
                    fill
                    unoptimized
                    className="object-contain"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-xs text-gray-500">
                    Sem imagem
                  </span>
                )}
              </div>
              <figcaption className="mt-1 text-center text-xs text-gray-500">
                {label}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {action.image_jobs?.map((job, i) => (
        <div key={i} className="rounded-lg bg-gray-50 p-3 text-sm">
          <strong>
            {job.label} ·{" "}
            {job.target === "item"
              ? "Produto"
              : job.target === "logo"
                ? "Logo"
                : "Banner"}
          </strong>
          <p className="mt-1 whitespace-pre-wrap text-gray-600">{job.prompt}</p>
        </div>
      ))}
      {operationGroups.map((operations, groupIndex) => {
        const first = operations[0],
          grouped = operations.length > 1;

        if (grouped)
          return (
            <div
              key={`${first.kind}:${first.entity}:${groupIndex}`}
              className={flat ? styles.operationGroup : "overflow-hidden rounded-lg border border-gray-100 bg-white"}
            >
              <GroupHeading className={flat ? "" : "bg-gray-50 px-3 py-2 text-sm font-medium"}>
                {groupHeading(first, operations.length)}
              </GroupHeading>
              <div className={flat ? styles.operationRows : "divide-y divide-gray-100"}>
                {operations.map((op, i) => {
                  const copy = operationCopy(op, refs);
                  return (
                    <div key={i} className="px-3 py-3">
                      <p className="text-sm text-gray-700">{copy.summary}</p>
                      {details(op)}
                    </div>
                  );
                })}
              </div>
              {first.kind === "delete" && (
                <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
                  O histórico será preservado; registros em uso não podem ser
                  excluídos.
                </p>
              )}
            </div>
          );

        const op = first,
          copy = operationCopy(op, refs);
        return (
          <div
            key={`${op.kind}:${op.entity}:${groupIndex}`}
            className={flat ? styles.operationGroup : "overflow-hidden rounded-lg border border-gray-100 bg-white"}
          >
            <GroupHeading className={flat ? "" : "bg-gray-50 px-3 py-2 text-sm font-medium"}>
              {showAllDetails
                ? copy.heading.replace("Upsell", "oferta no carrinho")
                : copy.heading}
            </GroupHeading>
            <div className={flat ? styles.operationRows : "px-3 pt-3"}>
              <p className="text-sm text-gray-700">{copy.summary}</p>
              {details(op)}
            </div>
            {op.kind === "delete" ? (
              <p className="px-3 pb-3 pt-1 text-xs text-gray-500">
                O histórico será preservado; registros em uso não podem ser
                excluídos.
              </p>
            ) : (
              <div className="h-3" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}
function ActionPeek({ action, refs }: { action: Action; refs: Record<string, string> }) {
  const operations = action.operations.filter((op) => !action.image || !Object.keys(op.values).every((key) => ["image_path", "logo_url", "banner_url"].includes(key))),
    imageLabel = action.operations[0]?.label || action.title.replace(/^Atualizar imagem:\s*/, "");
  const previewValue = (field: string, value: unknown, op: Operation) => {
    const text = display(field, value, refs, op);
    return text.length > 180 ? `${text.slice(0, 177)}…` : text;
  };
  return <div className={styles.previewList}>
    {action.image && <div>
      <p className={styles.previewSubject}>{imageLabel}</p>
      <div className="mt-2"><ActionPreview action={{ ...action, operations: [] }} refs={refs} /></div>
    </div>}
    {action.image_jobs?.slice(0, 2).map((job, index) => <div key={index}>
      <p className={styles.previewSubject}>{job.label}</p><p className={styles.previewSentence}>Gerar uma nova prévia para você revisar.</p>
    </div>)}
    {operations.slice(0, 2).map((op, index) => <div key={index}>
      <p className={styles.previewSubject}>{subject(op, refs)}</p>
      {op.kind === "update" && ["availability_json", "delivery_fee_json", "delivery_neighborhood_fee_json", "automatic_promotions", "pizza_settings"].some((field) => Object.hasOwn(op.values, field)) ? (
        <p className={styles.previewSentence}>{operationCopy(op, refs).summary}</p>
      ) : op.kind === "update" ? <dl className={styles.previewFields}>{Object.entries(op.values).slice(0, 2).map(([field, value]) => <div key={field}>
        <dt>{labels[field] || field}</dt><dd className={styles.changeValues}>
          <span className="sr-only">Antes: </span><span className={styles.before}>{previewValue(field, op.before?.[field], op)}</span>
          <span aria-hidden="true">→</span><span className="sr-only">Depois: </span><span className={styles.after}>{previewValue(field, value, op)}</span>
        </dd>
      </div>)}</dl> : <p className={styles.previewSentence}>{op.entity === "upsell" && op.kind === "create"
        ? `Sugestão no carrinho${op.values.position != null ? ` · posição ${Number(op.values.position) + 1}°` : ""}.`
        : operationCopy(op, refs).summary}</p>}
    </div>)}
  </div>;
}

const states: Record<string, string> = {
  pending: "Aguardando aprovação",
  applying: "Aplicando…",
  applied: "Aplicado",
  undone: "Desfeito",
  rejected: "Descartado",
  conflict: "Requer revisão",
  failed: "Não concluído",
};

function actionState(action: Action) {
  if (action.image_jobs?.length) {
    if (action.status === "pending") return "Aguardando geração";
    if (action.status === "applying") return "Gerando…";
    if (action.status === "applied") return "Prévias geradas";
    if (action.status === "undone") return "Prévias descartadas";
  }
  if (action.image) {
    if (action.status === "pending") return "Aguardando publicação";
    if (action.status === "applying") return "Publicando…";
    if (action.status === "applied") return "Publicado";
    if (action.status === "undone") return "Publicação desfeita";
  }
  return states[action.status] || action.status;
}
export function ActionCard({
  action,
  refs,
  disabled,
  onAction,
  compact = false,
  generatedActions = [],
  locked = false,
  onUpgrade,
}: {
  action: Action;
  refs: Record<string, string>;
  disabled: boolean;
  onAction: (command: string, ids: string[]) => void;
  compact?: boolean;
  generatedActions?: Action[];
  locked?: boolean;
  onUpgrade?: () => void;
}) {
  const retry =
      action.attempts < 2 &&
      (action.status === "failed" ||
        (action.status === "applying" &&
          !!action.claimed_at &&
          Date.parse(action.claimed_at) < Date.now() - 360000)),
    imageBatch = !!action.image_jobs?.length,
    imagePreview = !!action.image,
    generatedCount = generatedActions.length,
    pendingImageJobs = imageBatch
      ? action.image_jobs!.slice(generatedCount)
      : [],
    hasDiscardablePreviews = generatedActions.some((generated) =>
      ["pending", "failed", "conflict"].includes(generated.status),
    ),
    publishableGeneratedActions = generatedActions.filter(
      (generated) =>
        generated.status === "pending" ||
        (generated.attempts < 2 &&
          (generated.status === "failed" ||
            (generated.status === "applying" &&
              !!generated.claimed_at &&
              Date.parse(generated.claimed_at) < Date.now() - 360000))),
    ),
    publishedGeneratedCount = generatedActions.filter(
      (generated) => generated.status === "applied",
    ).length,
    countLabel = imageBatch
      ? action.status === "applied"
        ? `${generatedCount || action.generated_actions?.length || action.image_jobs!.length} ${(generatedCount || action.generated_actions?.length || action.image_jobs!.length) === 1 ? "imagem gerada" : "imagens geradas"}`
        : generatedCount
          ? `${generatedCount} de ${action.image_jobs!.length} imagens geradas`
          : `${action.image_jobs!.length} ${action.image_jobs!.length === 1 ? "imagem para gerar" : "imagens para gerar"}`
      : imagePreview
        ? action.status === "applied"
          ? "Imagem publicada"
          : "Prévia pronta para revisar"
        : `${action.operations.length} ${action.operations.length === 1 ? "alteração proposta" : "alterações propostas"}`,
    gateApply = (content: ReactNode) =>
      locked ? (
        <Tooltip text={IA_PLUS_FEATURE_MESSAGE} parentClassName="!inline-block">
          {content}
        </Tooltip>
      ) : (
        content
      );
  const actionButtons = (
      <div className={compact ? styles.actionButtons : "mt-3 flex flex-wrap gap-2"}>
        {(action.status === "pending" || retry) && (
          <>
            {gateApply(
              <Button
                disabled={!locked && disabled}
                onClick={() =>
                  locked ? onUpgrade?.() : onAction("apply", [action.id])
                }
              >
                {retry
                  ? imageBatch
                    ? "Tentar gerar novamente"
                    : imagePreview
                      ? "Tentar publicar novamente"
                      : "Tentar novamente"
                  : imageBatch
                    ? `Gerar imagens (${action.image_jobs!.length})`
                    : imagePreview
                      ? "Publicar imagem"
                      : "Aplicar"}
                {locked && <Lock size={14} className="ml-1" aria-hidden="true" />}
              </Button>,
            )}
            <Button
              variant="secondary"
              disabled={disabled}
              onClick={() => onAction("reject", [action.id])}
            >
              Descartar
            </Button>
          </>
        )}
        {action.status === "applied" &&
          imageBatch &&
          publishableGeneratedActions.length > 0 &&
          gateApply(
            <Button
              disabled={!locked && disabled}
              onClick={() =>
                locked
                  ? onUpgrade?.()
                  : onAction(
                      "apply",
                      publishableGeneratedActions.map(
                        (generated) => generated.id,
                      ),
                    )
              }
            >
              {publishedGeneratedCount > 0
                ? "Publicar restantes"
                : "Publicar todas"}{" "}
              ({publishableGeneratedActions.length})
              {locked && <Lock size={14} className="ml-1" aria-hidden="true" />}
            </Button>,
          )}
        {action.status === "applied" && (!imageBatch || hasDiscardablePreviews) && (
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => onAction("undo", [action.id])}
          >
            {imageBatch ? "Descartar prévias pendentes" : "Desfazer"}
          </Button>
        )}
        {action.status === "conflict" && (
          <p className="text-xs text-gray-500">
            Peça no chat uma proposta atualizada para este registro.
          </p>
        )}
      </div>
  );
  if (compact) return (
    <article className={styles.action} aria-label={action.title}>
      <div className={styles.actionHeader}>
        <p className={styles.actionCount}>{countLabel}</p>
        <span className={`${styles.actionState} ${action.status === "applied" ? styles.applied : ["conflict", "failed"].includes(action.status) ? styles.needsReview : ""}`}>{actionState(action)}</span>
      </div>
      {(!imageBatch || !generatedCount) && <ActionPeek action={action} refs={refs} />}
      {imageBatch && generatedCount > 0 && pendingImageJobs.length > 0 && (
        <ActionPeek action={{ ...action, image_jobs: pendingImageJobs, operations: [] }} refs={refs} />
      )}
      {!imagePreview && (
        <details className={styles.disclosure}>
          <summary>{imageBatch ? "Ver detalhes" : action.operations.length > 2 ? `Ver todas as ${action.operations.length} alterações` : "Ver alterações"}<ChevronDown size={13} aria-hidden="true" /></summary>
          <div className={styles.fullPreview}>
            <h4 className="text-sm font-medium">{action.title}</h4>
            <p>{action.reason}</p>
            <ActionPreview action={action} refs={refs} showAllDetails flat />
          </div>
        </details>
      )}
      {imageBatch && generatedCount > 0 && (
        <div className="mt-4 grid gap-3 border-t border-[var(--panel-border)] pt-4">
          <p className="text-xs font-medium text-[var(--panel-muted)]">Revisar imagens</p>
          {generatedActions.map((generated) => (
            <ActionCard
              key={generated.id}
              action={generated}
              refs={refs}
              disabled={disabled}
              onAction={onAction}
              locked={locked}
              onUpgrade={onUpgrade}
              compact
            />
          ))}
        </div>
      )}
      {action.error && <p role="status" className="mt-3 text-xs text-red-700">{action.error}</p>}
      {actionButtons}
      {action.image_jobs && <p className="mt-2 text-xs text-[var(--panel-muted)]">{generatedCount ? publishableGeneratedActions.length ? "Revise cada prévia ou publique todas de uma vez." : "Todas as imagens foram revisadas." : "As imagens serão geradas para revisão antes de serem publicadas."}</p>}
    </article>
  );
  return (
    <article className="my-4 rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel-background)] p-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900">{action.title}</h3>
        <span
          className={`rounded-full px-2 py-1 text-[11px] ${action.status === "applied" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}
        >
          {actionState(action)}
        </span>
      </div>
      <p className="mb-2 text-sm text-gray-600">{action.reason}</p>
      <ActionPreview action={action} refs={refs} />
      {action.error && (
        <p role="status" className="mt-3 text-xs text-red-700">
          {action.error}
        </p>
      )}
      {actionButtons}
      {action.image_jobs && (
        <p className="mt-2 text-xs text-gray-500">
          Gerar não publica. Imagens já publicadas devem ser desfeitas no cartão
          correspondente.
        </p>
      )}
    </article>
  );
}
export function DataCard({ card, expanded = false, presentation = "chat" }: { card: Data; expanded?: boolean; presentation?: "chat" | "report" }) {
  if (card.type === "item")
    return (
      <div className="my-3 flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
        {card.image_url && (
          <Image
            src={card.image_url}
            alt={card.name}
            width={64}
            height={64}
            unoptimized
            className="h-16 w-16 rounded-lg object-cover"
          />
        )}
        <div>
          <strong className="text-sm">{card.name}</strong>
          <p className="text-xs text-gray-500">{card.description}</p>
          <p className="mt-1 text-sm">{money(card.price_cents)}</p>
        </div>
      </div>
    );
  if (card.type === "potential") {
    const minCents = Number(card.min_cents ?? card.cents),
      maxCents = Number(card.max_cents ?? card.cents),
      minPercent = Number(card.min_percent ?? card.percent),
      maxPercent = Number(card.max_percent ?? card.percent),
      hasRange =
        Number.isFinite(minCents) &&
        Number.isFinite(maxCents) &&
        maxCents > minCents;
    if (presentation === "report") return (
      <div className={styles.potential}>
        {card.available ? <>
          <p className={`${styles.gain} ${hasRange ? styles.range : ""}`}><span>+{money(minCents)}</span>{hasRange && <span className={styles.rangeEnd}><span className={styles.rangeSeparator}>a</span><span>{money(maxCents)}</span></span>}</p>
          {Number.isFinite(minPercent) && Number.isFinite(maxPercent) && <p className={styles.growth}>
            <strong><TrendingUp size={14} aria-hidden="true" />+{minPercent.toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 })}{maxPercent > minPercent ? ` a ${maxPercent.toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : ""}</strong><span>de receita estimada</span>
          </p>}
          <details className={styles.disclosure}>
            <summary>Como estimamos<ChevronDown size={13} aria-hidden="true" /></summary>
            <div className={styles.calculation}>
              {!!card.breakdown?.length && <ul>{card.breakdown.map((item: Data, index: number) => <li key={index}><strong>{item.label}:</strong> {item.basis}</li>)}</ul>}
              <p>{[card.assumptions || card.formula, card.note].filter(Boolean).join(" ")}</p>
            </div>
          </details>
        </> : <><p className={styles.gain}>Ainda sem estimativa</p><p className={styles.comparisonNote}>{card.reason || "Faltam dados para estimar o ganho com segurança."}</p></>}
      </div>
    );
    return (
      <div className="my-4 rounded-[10px] border border-gray-200 bg-white p-4">
        {card.available ? (
          <>
            {!card.hide_period_label && <p className="text-sm text-gray-600">
              {Number(card.days) === 7
                ? "Potencial na próxima semana"
                : "Potencial nas próximas 4 semanas"}
            </p>}
            <p className="my-2 text-3xl font-semibold text-[#D93D00]">
              +{money(minCents)}
              {hasRange ? ` a ${money(maxCents)}` : ""}
            </p>
            {Number.isFinite(minPercent) && Number.isFinite(maxPercent) && (
              <p className="text-sm font-medium text-[#D93D00]">
                +{minPercent.toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                {maxPercent > minPercent
                  ? ` – +${maxPercent.toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
                  : ""}{" "}
                de receita estimada
              </p>
            )}
            <details className="mt-2 text-xs text-gray-600">
              <summary className="cursor-pointer">Como estimamos</summary>
              {Array.isArray(card.breakdown) && card.breakdown.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {card.breakdown.map((item: Data, i: number) => (
                    <li key={i}>
                      <strong>{item.label}:</strong> {item.basis}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2">{[card.assumptions || card.formula, card.note].filter(Boolean).join(" ")}</p>
            </details>
          </>
        ) : (
          <p className="text-sm">{card.reason}</p>
        )}
      </div>
    );
  }
  if (card.type === "benchmark" && presentation === "report") {
    const formatMetric = (key: string, value: number) =>
      key === "ticket_cents"
        ? money(value)
        : key === "units_per_order"
          ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : value.toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return <>
      <h3><TrendingUp size={17} aria-hidden="true" />Restaurantes parecidos no iMenu</h3>
      <p className={styles.comparisonNote}>{card.available ? card.method : card.reason || card.method}</p>
      {card.available && <>
        <dl className={styles.comparisonMetrics}>{Object.entries(card.medians || {}).map(([key, value]) => {
          const benchmarkValue = Number(value),
            currentValue = Number(card.current?.[key]),
            hasCurrent = Number.isFinite(currentValue),
            comparisonClass = !hasCurrent || currentValue === benchmarkValue
              ? styles.comparisonBadgeNeutral
              : currentValue > benchmarkValue
                ? styles.comparisonBadgePositive
                : styles.comparisonBadgeNegative;
          return <div key={key}>
            <dt>{{ beverage_rate: "Pedidos com bebida", combo_rate: "Pedidos com combo", units_per_order: "Itens por pedido", retention: "Recompra", ticket_cents: "Ticket médio" }[key] || key}</dt>
            <dd><span>{formatMetric(key, benchmarkValue)}</span>{hasCurrent && <span className={`${styles.comparisonBadge} ${comparisonClass}`}>Você: {formatMetric(key, currentValue)}</span>}</dd>
          </div>;
        })}</dl>
        {!!card.public_menus?.length && <div className={styles.menuLinks}><span>Cardápios para referência</span><div className={styles.menuBadges}>{card.public_menus.map((menu: Data) => <a className={styles.menuBadge} key={menu.url} href={menu.url} target="_blank" rel="noreferrer">
          {menu.logo_url ? <Image src={menu.logo_url} alt="" width={24} height={24} unoptimized className={styles.menuBadgeLogo} /> : <span className={styles.menuBadgeFallback} aria-hidden="true">{String(menu.name || "?").trim().slice(0, 1).toUpperCase()}</span>}
          <span>{menu.name}</span><ArrowUpRight size={13} aria-hidden="true" />
        </a>)}</div></div>}
      </>}
    </>;
  }
  if (card.type === "benchmark")
    return (
      <details open={expanded} className="my-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
        <summary className="cursor-pointer font-medium">
          Restaurantes semelhantes{" "}
          {card.available ? `· ${card.count} na comparação` : ""}
        </summary>
        <p className="mt-2 text-xs text-gray-500">
          {card.available ? card.method : card.reason || card.method}
        </p>
        {card.available && (
          <>
            <dl className="my-3 grid grid-cols-2 gap-2 text-xs">
              {Object.entries(card.medians).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-gray-500">
                    {
                      {
                        beverage_rate: "Pedidos com bebida",
                        combo_rate: "Pedidos com combo",
                        units_per_order: "Itens por pedido",
                        retention: "Recompra",
                        ticket_cents: "Ticket médio",
                      }[k]
                    }
                  </dt>
                  <dd>
                    {k === "ticket_cents"
                      ? money(Number(v))
                      : k === "units_per_order"
                        ? Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : Number(v).toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-gray-500">
              Cardápios públicos para referência
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {card.public_menus.map((p: Data) => (
                <a
                  key={p.url}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-[#D93D00] underline"
                >
                  {p.name}
                </a>
              ))}
            </div>
          </>
        )}
      </details>
    );
  if (card.type === "measurement" && card.results?.length)
    return (
      <details open={expanded} className="my-3 rounded-lg border border-gray-200 p-3 text-sm">
        <summary className="cursor-pointer font-medium">
          Resultados das mudanças
        </summary>
        <p className="my-2 text-xs text-gray-500">{card.note}</p>
        {card.results.filter((r: Data) => r.before.orders || r.after.orders).map((r: Data) => (
          <div key={r.id} className="border-t border-gray-100 py-2">
            <strong className="text-xs">{r.title}</strong>
            <p className="text-xs">
              Ticket: {money(r.before.ticket_cents)} →{" "}
              {money(r.after.ticket_cents)} · Pedidos: {r.before.orders} →{" "}
              {r.after.orders}
            </p>
            <p className="text-xs text-gray-500">
              {Number(r.after.days).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias em cada período.
            </p>
          </div>
        ))}
      </details>
    );
  return null;
}
