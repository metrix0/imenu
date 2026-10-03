import { SalesError, type Data } from "./types";

export const DIMENSIONS = [
  "ordering_visibility",
  "images",
  "names_spelling",
  "descriptions",
  "pricing",
  "duplicates",
  "upsells_combos",
  "promotions",
  "loyalty",
  "configuration",
  "sales",
  "traffic",
  "benchmark",
  "past_actions",
] as const;
const string = { type: "string" };
const array = (items: Data) => ({ type: "array", items });
const object = (properties: Data) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const level = { type: "string", enum: ["high", "medium", "low"] };
const inspection = object({
  status: { type: "string", enum: ["inspected", "unavailable"] },
  note: string,
});
const evidence = object({
  source: string,
  detail: string,
  entity_ids: array(string),
});
export const REPORT_FORMAT = {
  type: "json_schema" as const,
  name: "sales_analysis",
  strict: true,
  schema: object({
    headline: string,
    summary: string,
    inspection: object(
      Object.fromEntries(DIMENSIONS.map((d) => [d, inspection])),
    ),
    opportunities: array(
      object({
        title: string,
        explanation: string,
        impact: level,
        confidence: level,
        effort: level,
        risk: level,
        evidence: array(evidence),
        action_ids: array(string),
      }),
    ),
    review_items: array(
      object({
        title: string,
        explanation: string,
        evidence: array(evidence),
        action_ids: array(string),
      }),
    ),
  }),
};
export const REPORT_INSTRUCTIONS = `
Para análise profunda, substitua o formato reply/summary, os marcadores de widgets e a seção final Markdown pelo schema sales_analysis.
Inspecione CADA dimensão obrigatória usando o resumo determinístico e, quando uma decisão depender de detalhes exatos, use read_data de forma seletiva. O snapshot completo continua no servidor, mas não é despejado integralmente no prompt. Registre inspection para todas as dimensões: inspected quando os dados disponíveis sustentarem a avaliação; unavailable se faltarem dados (explique). Não pagine ou leia tabelas inteiras por rotina: busque apenas os registros que podem mudar uma recomendação de alta alavancagem.
As fotos reais carregadas são uma amostra dos produtos mais vendidos, escolhida para limitar custo. Avalie todas as fotos realmente carregadas: nitidez, iluminação, enquadramento, fundo, legibilidade do produto e coerência com o nome/descrição, sem inventar ingredientes ou julgar sabor. image_review também informa fotos ausentes, indisponíveis e não revisadas; nunca afirme ter avaliado visualmente uma foto que não foi carregada. Se uma melhoria visual for relevante, use propose_images com o item_id correto, preservando ingredientes, porção e identidade; gerar e publicar continuam exigindo as aprovações existentes. Uma foto aceitável não precisa de proposta.
Inspeção não é recomendação. opportunities contém somente achados de alta alavancagem, priorizados por impacto e confiança, depois menor esforço e risco. Inclua evidências verificáveis e os IDs exatos de propose_action/propose_images. Não invente IDs nem números. Reutilize propostas válidas pendentes quando apropriado e considere ações aplicadas, rejeitadas, desfeitas e resultados anteriores. review_items guarda apenas questões relevantes que dependem de decisão do dono. Não registre pensamentos nem correções cosméticas deliberadamente descartadas.
O contexto inicial contém um resumo comercial compacto, contagens de cobertura, principais produtos e sinais de anomalia. Use read_data somente para confirmar o estado exato de itens/configurações que possam virar proposta. Measurement contém as comparações reais antes/depois. Prior_analyses contém um resumo estruturado recente, não uma conversa a repetir. Headline e summary devem ser curtos. Cada explicação tem no máximo duas frases. Projeção monetária vem somente de estimate_revenue; o servidor preservará os snapshots de cobertura, período, comparação, medição e potencial.
Texto para o dono: summary é uma frase sobre a principal melhoria, sem abrir com quantidade de pedidos, receita, ticket médio ou uma "Base analisada". Cada explanation traz apenas o dado que justifica a decisão e a melhoria sugerida, em até duas frases curtas (cerca de 40 palavras); detalhes adicionais ficam em evidence, sem repetir a mesma conclusão nem descrever todas as operações do cartão Aplicar. Não crie checklist de prioridades ou prazo de execução.
Use linguagem simples também em evidence.detail, review_items e hipóteses de projeção: nunca exponha nomes de campos, SQL, IDs internos, nomes de ferramentas, "embedding", "mediana anônima", "benchmark" ou "atribuição causal". Traduza configurações para seu efeito no restaurante (por exemplo, "o kit permite escolher só um hambúrguer"). source e entity_ids são referências internas; detail é texto visível ao dono. Comparações devem dizer "restaurantes parecidos no iMenu" e usar apenas números reais que ajudem a decidir. A interface apresenta uma única estimativa em R$ e % no topo, após o resumo, e cada proposta junto da oportunidade; não repita o cálculo no texto.
Justifique a prioridade pelo efeito comercial esperado, sem confundir certeza sobre um erro com certeza de aumento nas vendas. Uma seleção incompleta de kit é um problema operacional confirmado, mas não implica impacto alto na receita sem evidência. Vendas de combos demonstram demanda, não comprovam que a posição atual reduz vendas: trate a nova posição como uma hipótese. Separe correções independentes, como ocultar uma duplicata, quando elas exigirem decisões distintas.
Preserve nomes promocionais, como "Pague 4 leve 5", salvo evidência de que a oferta é incorreta e uma mudança justificada; prefira esclarecer quantidade e escolhas sem retirar o apelo comercial. Configurações que possam impedir compras, como frete ou horário incoerentes, merecem atenção proporcional ao efeito e devem ser sinalizadas claramente para revisão quando a operação real precisa ser confirmada.
As taxas de adesão e melhora usadas na projeção são hipóteses, não resultados observados. Escreva assumptions em um único parágrafo curto, explicando quais mudanças entram na estimativa, as hipóteses principais e quais ganhos não puderam ser calculados. Não repita a fórmula. Use números em português do Brasil: 10%, 0,6% e R$ 6,00.
`;

function validate(value: any, schema: Data): boolean {
  if (schema.type === "string")
    return (
      typeof value === "string" && (!schema.enum || schema.enum.includes(value))
    );
  if (schema.type === "array")
    return (
      Array.isArray(value) && value.every((v) => validate(v, schema.items))
    );
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).every((k) => k in schema.properties) &&
    schema.required.every((k: string) =>
      validate(value[k], schema.properties[k]),
    )
  );
}
export function makeReport(
  ctx: Data,
  cards: Data[],
  actions: Data[],
  run: string,
  value?: Data,
): Data {
  if (value && !validate(value, REPORT_FORMAT.schema))
    throw new SalesError("O formato da análise não foi concluído.");
  const allowed = new Set(actions.map((a) => a.id));
  const linked = new Set<string>();
  const link = (entry: Data, index: number) => ({
    ...entry,
    id: `${run}:${index}`,
    action_ids: entry.action_ids.filter((id: string) => {
      if (!allowed.has(id) || linked.has(id)) return false;
      linked.add(id);
      return true;
    }),
  });
  const priority: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const opportunities = (value?.opportunities || [])
    .map(link)
    .sort(
      (a: Data, b: Data) =>
        priority[b.impact] - priority[a.impact] ||
        priority[b.confidence] - priority[a.confidence] ||
        priority[a.effort] - priority[b.effort] ||
        priority[a.risk] - priority[b.risk],
    );
  const reviewItems = (value?.review_items || []).map((v: Data, i: number) =>
    link(v, opportunities.length + i),
  );
  // Preserve every proposal made in this run even if synthesis was interrupted or omitted its ID.
  for (const a of actions.filter(
    (a) => a.run_id === run && !linked.has(a.id),
  )) {
    reviewItems.push({
      id: `${run}:action:${a.id}`,
      title: a.title,
      explanation: a.reason,
      evidence: [],
      action_ids: [a.id],
    });
  }
  const inspected = value?.inspection
    ? { ...value.inspection }
    : Object.fromEntries(
        DIMENSIONS.map((d) => [
          d,
          {
            status: "not_inspected",
            note: "Síntese não concluída; inspeção não confirmada.",
          },
        ]),
      );
  if (value) {
    if (
      ctx.image_review?.unavailable > 0 ||
      ctx.image_review?.not_reviewed > 0
    ) {
      const loaded = Number(ctx.image_review.loaded || 0),
        unavailable = Number(ctx.image_review.unavailable || 0),
        notReviewed = Number(ctx.image_review.not_reviewed || 0),
        details = [
          `${loaded} fotos revisadas visualmente`,
          unavailable ? `${unavailable} não puderam ser abertas` : "",
          notReviewed ? `${notReviewed} não foram revisadas visualmente` : "",
        ]
          .filter(Boolean)
          .join("; ");
      inspected.images = {
        status: unavailable > 0 || loaded === 0 ? "unavailable" : "inspected",
        note: `${details}. ${inspected.images.note}`,
      };
    }
    for (const [dimension, source] of [
      ["traffic", ctx.traffic],
      ["benchmark", ctx.peers],
      ["past_actions", ctx.measurement],
    ] as const) {
      if (source?.available === false)
        inspected[dimension] = {
          status: "unavailable",
          note: source.reason || "Dados indisponíveis nesta análise.",
        };
    }
  }
  const snapshot = (type: string, fallback: Data) =>
    cards.filter((c) => c.type === type).at(-1) || fallback;
  return {
    version: 1,
    status: value ? "complete" : "partial",
    headline: value?.headline || "Análise interrompida",
    summary:
      value?.summary ||
      "O relatório não foi concluído. As propostas preparadas foram preservadas para revisão. Você pode tentar uma nova análise.",
    inspection: inspected,
    opportunities,
    review_items: reviewItems,
    coverage: {
      ...ctx.coverage,
      dimensions: Object.fromEntries(
        DIMENSIONS.map((d) => [d, inspected[d].status]),
      ),
    },
    benchmark_snapshot: snapshot("benchmark", { available: false }),
    measurement_snapshot: snapshot("measurement", { available: false }),
    potential_estimate: snapshot("potential", {
      available: false,
      reason: "Não foi calculada uma projeção nesta análise.",
    }),
    traffic_snapshot: ctx.traffic || { available: false },
    sales_snapshot: ctx.sales || null,
    period: { start: ctx.sales?.start || null, end: ctx.sales?.end || null },
    generated_at: new Date().toISOString(),
  };
}
