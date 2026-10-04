import { renderToStaticMarkup } from "react-dom/server";
import AnalysisReport from "@/components/restaurant-owner/ia-vendas/AnalysisReport";
import SalesMarkdown from "@/components/restaurant-owner/ia-vendas/SalesMarkdown";
import { ActionCard, DataCard } from "@/components/restaurant-owner/ia-vendas/SalesWidgets";
import type { Action } from "../types";
import { analysisPreview } from "../paywall";

jest.mock("@/components/restaurant-owner/ia-vendas/AnalysisReport.module.css", () => ({
  __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

jest.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => "/painel/ia-vendas",
  useRouter: () => ({ push: jest.fn() }),
}));

const action: Action = {
  id: "proposal",
  restaurant_id: "restaurant",
  conversation_id: "analysis",
  title: "Ajustar as escolhas",
  reason: "Exigir a quantidade completa.",
  status: "pending",
  attempts: 0,
  created_at: "2026-10-02T22:22:56Z",
  operations: [{
    entity: "item_subcategories",
    kind: "update",
    id: "group",
    label: "Escolha os sabores",
    before: { min_select: 1 },
    values: { min_select: 5 },
  }],
};
const potential = {
  available: true, cents: 2880, percent: 0.0058115, days: 28,
  formula: "Fórmula que repete a hipótese.",
  assumptions: "Se 10% dos pedidos acrescentarem uma bebida de R$ 6,00.",
  note: "É uma estimativa, não uma garantia.",
};
const props = {
  analyses: [], selected: { id: "run", result: { report: {
    headline: "Mais bebidas", summary: "Ofereça uma bebida no carrinho.",
    opportunities: [{
      id: "opportunity", title: "Ofereça uma bebida", explanation: "Há pedidos sem bebida.",
      impact: "medium", confidence: "medium", effort: "low", risk: "low",
      evidence: [{ detail: "Dado conferido" }], action_ids: [action.id],
    }],
    review_items: [{
      id: "review", title: "Confirme o frete", explanation: "Confira a taxa.",
      evidence: [], action_ids: [],
    }],
    potential_estimate: potential,
    benchmark_snapshot: { available: false, reason: "Ainda não há restaurantes suficientes.", method: "Método de comparação" },
    measurement_snapshot: { results: [{ before: { orders: 0 }, after: { orders: 0 } }], note: "Ainda não há vendas para comparar." },
    period: { start: "2026-09-04T12:00:00Z", end: "2026-10-02T12:00:00Z" },
  }}},
  actions: [action], refs: {}, disabled: false, loading: false, generating: false,
  status: "", onSelect: jest.fn(), onDiscuss: jest.fn(), onChat: jest.fn(), onHistory: jest.fn(),
  onAction: jest.fn(), onBatch: jest.fn(),
};

test("report leads with potential actions, then summary, opportunities, comparison and review", () => {
  const html = renderToStaticMarkup(<AnalysisReport {...props} />);
  const positions = [
    'aria-label="Potencial estimado"', 'aria-label="Resumo da IA"',
    'aria-label="Prioridades"', 'aria-label="Comparações"',
    "Pontos rápidos para revisão",
  ].map((label) => html.indexOf(label));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(html).toContain("Ainda não há restaurantes suficientes.");
  expect(html).not.toContain("Ainda não há vendas para comparar.");
  expect(html).not.toContain("Resultados das mudanças");
  expect(html).not.toContain("Ticket:");
  expect(html).not.toContain("oportunidades priorizadas");
  expect(html).toContain("O que seu restaurante pode ganhar em 4 semanas");
  expect(html).toContain('aria-label="Prioridades" class="opportunitiesCard"');
  expect(html).toContain("Revisar e aplicar tudo");
  expect(html).toContain("Conversar com Assistente de IA");
  expect(html).not.toContain("Potencial nas próximas 4 semanas");
  expect(html).toContain('aria-label="Pontos rápidos para revisão" class="review"');
  expect(html).not.toContain('<summary class="reviewSummary">');
  expect(html).toContain("Confirme o frete");
  expect(html).not.toContain("<p>Confirme o frete</p>");
});

test("free restaurant without analysis explains the analysis and IA Plus immediate access", () => {
  const html = renderToStaticMarkup(<AnalysisReport {...props} analyses={[]} selected={undefined} locked />);
  expect(html).toContain("Sua análise ainda não foi liberada");
  expect(html).toContain("Entende suas vendas");
  expect(html).toContain("Encontra o que vale priorizar");
  expect(html).toContain("Aplica melhorias automaticamente");
  expect(html).toContain("Você apenas revisa e aceita as mudanças que aumentam seu faturamento.");
  expect(html.indexOf("Aplica melhorias automaticamente")).toBeLessThan(html.indexOf("Entende suas vendas"));
  expect(html).toContain("Como funciona o acesso gratuito");
  expect(html).toContain("Sem esperar pela seleção gratuita");
  expect(html).toContain("Análise iniciada automaticamente");
  expect(html).toContain("Acesso completo às oportunidades encontradas");
  expect(html).toContain("IAPlusCombinationMarkLogo_Brand.png");
  expect(html).toContain("Começar análise agora");
  expect(html).toContain("A análise profunda pode levar até 1 hora para ser concluída após ativar o plano.");
  expect(html).toContain("49,99");
});

test("free analysis preview keeps the complete report", () => {
  const analysis = {
    id: "analysis",
    result: {
      report: {
        opportunities: [{ id: "one" }, { id: "two" }, { id: "three" }],
        review_items: [{ id: "review-one" }, { id: "review-two" }],
      },
    },
  };
  const visible = analysisPreview(analysis);
  expect(visible.result.report.opportunities).toHaveLength(3);
  expect(visible.result.report.review_items).toHaveLength(2);
});

test("locked analysis keeps the full report scrollable and overlays only its final quarter", () => {
  const html = renderToStaticMarkup(<AnalysisReport {...props} locked />);
  expect(html).toContain('class="report reportLocked"');
  expect(html).toContain("paper paperLocked");
  expect(html).not.toContain('class="previewContent"><section aria-label="Prioridades"');
  expect(html).toContain("IAPlusCombinationMarkLogo_Brand.png");
  expect(html).toContain('sizes="200px"');
  expect(html).toContain('class="structuredContent"');
  expect(html).toContain('class="paywallCard"');
  expect(html).toContain('aria-label="Comparações"');
  expect(html).not.toContain('hidden="" aria-label="Comparações"');
  expect(html.indexOf('aria-label="Comparações"')).toBeLessThan(html.indexOf("Coloque essas oportunidades em prática"));
  expect(html).toContain("paywall structuredPaywall");
  expect(html).toContain("Coloque essas oportunidades em prática");
  expect(html).toContain("Conhecer iMenu IA Plus");
});

test("analysis proposals preview changes, keep Apply visible and retain a collapsed full diff", () => {
  const html = renderToStaticMarkup(<ActionCard action={action} refs={{}} disabled={false} onAction={jest.fn()} compact />);
  expect(html).toMatch(/<details[^>]*><summary[^>]*>Ver alterações/);
  expect(html).not.toMatch(/<details[^>]*open/);
  expect(html).not.toContain("O que vai mudar");
  expect(html).toContain("Seleção mínima");
  expect(html).toContain("Antes:");
  expect(html).toContain("Depois:");
  expect(html.indexOf(">Aplicar<")).toBeGreaterThan(html.indexOf("</details>"));
  const normal = renderToStaticMarkup(<ActionCard action={action} refs={{}} disabled={false} onAction={jest.fn()} />);
  expect(normal).not.toContain("Ver alterações");
  expect(normal).toContain(action.title);
  expect(normal).toContain(action.reason);
});


test("image batches use generation and publication language and keep generated previews grouped", () => {
  const generated = (id: string, label: string): Action => ({
    ...action,
    id,
    title: `Atualizar imagem: ${label}`,
    status: "pending",
    image: { before: "https://example.com/before.webp", after: "https://example.com/after.webp" },
    operations: [{
      entity: "items",
      kind: "update",
      id: `item-${id}`,
      label,
      before: { image_path: "before.webp" },
      values: { image_path: "after.webp" },
    }],
  });
  const first = generated("image-1", "Cheddar Burger GRANDE"),
    second = generated("image-2", "Kids Burger"),
    batch: Action = {
      ...action,
      id: "image-batch",
      title: "Gerar prévias de imagens",
      status: "pending",
      operations: [],
      image_jobs: [
        { label: "Cheddar Burger GRANDE", target: "item", prompt: "Foto nova" },
        { label: "Kids Burger", target: "item", prompt: "Foto nova" },
      ],
      generated_actions: [],
    };

  const beforeGeneration = renderToStaticMarkup(
    <ActionCard action={batch} refs={{}} disabled={false} onAction={jest.fn()} compact />,
  );
  expect(beforeGeneration).toContain("Aguardando geração");
  expect(beforeGeneration).toContain("2 imagens para gerar");
  expect(beforeGeneration).toContain("Gerar imagens (2)");
  expect(beforeGeneration).toContain("As imagens serão geradas para revisão antes de serem publicadas.");
  expect(beforeGeneration).not.toContain(">Aplicar<");

  const afterGeneration = renderToStaticMarkup(
    <ActionCard
      action={{ ...batch, status: "applied", generated_actions: [first.id, second.id] }}
      generatedActions={[first, second]}
      refs={{}}
      disabled={false}
      onAction={jest.fn()}
      compact
    />,
  );
  expect(afterGeneration).toContain("Prévias geradas");
  expect(afterGeneration).toContain("2 imagens geradas");
  expect(afterGeneration).toContain("Revisar imagens");
  expect(afterGeneration).toContain("Cheddar Burger GRANDE");
  expect(afterGeneration).toContain("Kids Burger");
  expect(afterGeneration.match(/Publicar imagem/g)).toHaveLength(2);
  expect(afterGeneration).toContain("Publicar todas");
  expect(afterGeneration).toContain("(2)");
  expect(afterGeneration).toContain("Revise cada prévia ou publique todas de uma vez.");
  expect(afterGeneration).not.toContain(">Aplicar<");
  expect(afterGeneration).not.toContain("Gerar não publica");

  const partiallyPublished = renderToStaticMarkup(
    <ActionCard
      action={{ ...batch, status: "applied", generated_actions: [first.id, second.id] }}
      generatedActions={[{ ...first, status: "applied" }, second]}
      refs={{}}
      disabled={false}
      onAction={jest.fn()}
      compact
    />,
  );
  expect(partiallyPublished).toContain("Publicar restantes");
  expect(partiallyPublished).toContain("(1)");
  expect(partiallyPublished).not.toContain("Publicar todas (2)");
});

test("generated image previews show one review surface instead of duplicating the diff", () => {
  const imageAction: Action = {
    ...action,
    id: "image-preview",
    title: "Atualizar imagem: Cheddar Burger GRANDE",
    status: "pending",
    image: { before: "https://example.com/before.webp", after: "https://example.com/after.webp" },
    operations: [{
      entity: "items",
      kind: "update",
      id: "item",
      label: "Cheddar Burger GRANDE",
      before: { image_path: "before.webp" },
      values: { image_path: "after.webp" },
    }],
  };
  const html = renderToStaticMarkup(
    <ActionCard action={imageAction} refs={{}} disabled={false} onAction={jest.fn()} compact />,
  );
  expect(html).toContain("Aguardando publicação");
  expect(html).toContain("Prévia pronta para revisar");
  expect(html).toContain("Cheddar Burger GRANDE");
  expect(html).toContain("Publicar imagem");
  expect(html).not.toContain("Ver alterações");
});

test("potential uses Brazilian numbers and one explanation without repeating the formula", () => {
  const html = renderToStaticMarkup(<DataCard card={{ ...potential, type: "potential" }} />);
  expect(html).toContain("+0,6%");
  expect(html).toContain("28,80");
  expect(html).toContain("próximas 4 semanas");
  expect(html).toContain(potential.assumptions);
  expect(html).not.toContain(potential.formula);
  expect(html).not.toMatch(/<details[^>]*open/);

  const range = renderToStaticMarkup(<DataCard presentation="report" card={{
    ...potential,
    type: "potential",
    min_cents: 3120,
    max_cents: 6240,
    min_percent: 0.006,
    max_percent: 0.012,
  }} />);
  expect(range).toContain(">a</span><span>R$");
  expect(range).toContain("+0,6% a 1,2%");
  expect(range).not.toContain("–");
});

test("proposal states preserve undo and prevent applying discarded or conflicting actions", () => {
  const render = (status: Action["status"]) => renderToStaticMarkup(<ActionCard action={{ ...action, status }} refs={{}} disabled={false} onAction={jest.fn()} compact />);
  expect(render("applied")).toContain(">Desfazer<");
  expect(render("applied")).not.toContain(">Aplicar<");
  expect(render("rejected")).not.toContain(">Aplicar<");
  expect(render("conflict")).not.toContain(">Aplicar<");
  expect(render("conflict")).toContain("proposta atualizada");
});

test("report handles unavailable estimates and never invents a gain", () => {
  const html = renderToStaticMarkup(<DataCard presentation="report" card={{ type: "potential", available: false, reason: "Sem dados suficientes." }} />);
  expect(html).toContain("Ainda sem estimativa");
  expect(html).toContain("Sem dados suficientes.");
  expect(html).not.toContain("R$");
});


test("panel tab shortcuts render inline inside assistant text", () => {
  const html = renderToStaticMarkup(
    <SalesMarkdown
      content="Acesse [[tab:horarios]] para configurar o funcionamento."
      panelTabs={["horarios"]}
    />,
  );

  expect(html).toContain("Acesse ");
  expect(html).toContain(">Horários<");
  expect(html).toContain(" para configurar o funcionamento.");
  expect(html).not.toContain("[[tab:horarios]]");
  expect(html.indexOf("Acesse ")).toBeLessThan(html.indexOf("Horários"));
  expect(html.indexOf("Horários")).toBeLessThan(
    html.indexOf(" para configurar o funcionamento."),
  );
});

test("valid inline panel tab markers render even when the saved card is missing", () => {
  const html = renderToStaticMarkup(
    <SalesMarkdown content="Você pode adicionar o período manualmente em [[tab:horarios]], incluindo **01:00–03:00 hoje**." />,
  );

  expect(html).toContain("manualmente em ");
  expect(html).toContain(">Horários<");
  expect(html).toContain(", incluindo ");
  expect(html).not.toContain("[[tab:horarios]]");
});
