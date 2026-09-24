"use client";
import Image from "next/image";
import Button from "@/components/ui/Button";
import type { Action, Data } from "@/lib/ia-vendas/types";
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
const values: Record<string, string> = {
  percent: "Percentual",
  fixed: "Valor fixo",
  delivery: "Entrega",
  retirada: "Retirada",
  autoatendimento: "Mesa",
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
  if (Array.isArray(v)) return v.map((x) => display("", x, refs)).join("\n");
  if (typeof v === "object")
    return Object.entries(v)
      .map(
        ([key, value]) => `${labels[key] || key}: ${display(key, value, refs)}`,
      )
      .join("\n");
  return refs[v] || values[v] || String(v);
}
export function ActionPreview({
  action,
  refs = {},
}: {
  action: Action;
  refs?: Record<string, string>;
}) {
  return (
    <div className="space-y-3">
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
      {action.operations.map((op, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-lg border border-gray-200"
        >
          <div className="bg-gray-50 px-3 py-2 text-sm font-medium">
            {op.kind === "create"
              ? "Adicionar"
              : op.kind === "delete"
                ? "Excluir"
                : "Editar"}{" "}
            · {refs[op.id] || op.label}
          </div>
          {op.kind === "delete" ? (
            <p className="p-3 text-sm">
              Excluir este registro. O histórico será preservado; registros em
              uso não podem ser excluídos.
            </p>
          ) : (
            <dl className="divide-y divide-gray-100 text-xs">
              {Object.entries(op.values)
                .filter(
                  ([k]) =>
                    !action.image ||
                    !["image_path", "logo_url", "banner_url"].includes(k),
                )
                .map(([k, v]) => (
                  <div
                    key={k}
                    className="grid grid-cols-[1fr_1fr] gap-2 px-3 py-2"
                  >
                    <dt className="col-span-2 font-medium text-gray-700">
                      {labels[k] || k}
                    </dt>
                    <dd className="whitespace-pre-wrap break-words text-gray-500">
                      <span className="sr-only">Antes: </span>
                      {display(k, op.before?.[k], refs, op)}
                    </dd>
                    <dd className="whitespace-pre-wrap break-words text-gray-900">
                      <span className="sr-only">Depois: </span>
                      {display(k, v, refs, op)}
                    </dd>
                  </div>
                ))}
            </dl>
          )}
        </div>
      ))}
    </div>
  );
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
export function ActionCard({
  action,
  refs,
  disabled,
  onAction,
}: {
  action: Action;
  refs: Record<string, string>;
  disabled: boolean;
  onAction: (command: string, ids: string[]) => void;
}) {
  const retry =
    action.attempts < 2 &&
    (action.status === "failed" ||
      (action.status === "applying" &&
        !!action.claimed_at &&
        Date.parse(action.claimed_at) < Date.now() - 360000));
  return (
    <article className="my-3 rounded-[10px] border border-[#e2e5e9] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900">{action.title}</h3>
        <span
          className={`rounded-full px-2 py-1 text-[11px] ${action.status === "applied" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}
        >
          {states[action.status] || action.status}
        </span>
      </div>
      <p className="mb-3 text-sm text-gray-600">{action.reason}</p>
      <ActionPreview action={action} refs={refs} />
      {action.error && (
        <p role="status" className="mt-3 text-xs text-red-700">
          {action.error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {(action.status === "pending" || retry) && (
          <>
            <Button
              disabled={disabled}
              onClick={() => onAction("apply", [action.id])}
            >
              {retry ? "TENTAR NOVAMENTE" : "APLICAR"}
            </Button>
            <Button
              variant="secondary"
              disabled={disabled}
              onClick={() => onAction("reject", [action.id])}
            >
              Descartar
            </Button>
          </>
        )}
        {action.status === "applied" && (
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => onAction("undo", [action.id])}
          >
            {action.image_jobs ? "Descartar prévias pendentes" : "Desfazer"}
          </Button>
        )}
        {action.status === "conflict" && (
          <p className="text-xs text-gray-500">
            Peça no chat uma proposta atualizada para este registro.
          </p>
        )}
      </div>
      {action.image_jobs && (
        <p className="mt-2 text-xs text-gray-500">
          Gerar não publica. Imagens já publicadas devem ser desfeitas no cartão
          correspondente.
        </p>
      )}
    </article>
  );
}
export function DataCard({ card }: { card: Data }) {
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
  if (card.type === "potential")
    return (
      <div className="my-4 rounded-[10px] border border-orange-200 bg-orange-50 p-4">
        {card.available ? (
          <>
            <p className="text-sm text-gray-600">
              Potencial nas próximas 4 semanas
            </p>
            <p className="my-2 text-3xl font-semibold text-[#D93D00]">
              +{money(card.cents)}
            </p>
            <details className="text-xs text-gray-600">
              <summary className="cursor-pointer">Como estimamos</summary>
              <p className="mt-2">{card.formula}</p>
              <p className="mt-2">{card.assumptions}</p>
              <p className="mt-2">{card.note}</p>
            </details>
          </>
        ) : (
          <p className="text-sm">{card.reason}</p>
        )}
      </div>
    );
  if (card.type === "benchmark")
    return (
      <details className="my-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
        <summary className="cursor-pointer font-medium">
          Restaurantes semelhantes{" "}
          {card.available ? `· ${card.count} na comparação` : ""}
        </summary>
        <p className="mt-2 text-xs text-gray-500">
          {card.method || card.reason}
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
                        ? Number(v).toFixed(2)
                        : `${(Number(v) * 100).toFixed(1)}%`}
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
      <details className="my-3 rounded-lg border border-gray-200 p-3 text-sm">
        <summary className="cursor-pointer font-medium">
          Resultados das mudanças
        </summary>
        <p className="my-2 text-xs text-gray-500">{card.note}</p>
        {card.results.map((r: Data) => (
          <div key={r.id} className="border-t border-gray-100 py-2">
            <strong className="text-xs">{r.title}</strong>
            <p className="text-xs">
              Ticket: {money(r.before.ticket_cents)} →{" "}
              {money(r.after.ticket_cents)} · Pedidos: {r.before.orders} →{" "}
              {r.after.orders}
            </p>
            <p className="text-xs text-gray-500">
              {r.after.days.toFixed(1)} dias em cada janela.
            </p>
          </div>
        ))}
      </details>
    );
  return null;
}
