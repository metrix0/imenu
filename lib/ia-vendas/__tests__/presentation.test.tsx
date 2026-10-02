import { renderToStaticMarkup } from "react-dom/server";
import AnalysisReport from "@/components/restaurant-owner/ia-vendas/AnalysisReport";
import { ActionCard, DataCard } from "@/components/restaurant-owner/ia-vendas/SalesWidgets";
import type { Action } from "../types";

jest.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => "/painel/ia-vendas",
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
  status: "", onSelect: jest.fn(), onDiscuss: jest.fn(), onHistory: jest.fn(),
  onAction: jest.fn(), onBatch: jest.fn(),
};

test("report leads with summary and potential, then opportunities, review and comparison", () => {
  const html = renderToStaticMarkup(<AnalysisReport {...props} />);
  const positions = [
    'aria-label="Resumo da IA"', 'aria-label="Potencial estimado"',
    'aria-label="Oportunidades prioritárias"', "Pontos para revisão",
    'aria-label="Potencial e resultados"',
  ].map((label) => html.indexOf(label));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(html).toContain("Ainda não há restaurantes suficientes.");
  expect(html).toContain("Ainda não há vendas para comparar.");
  expect(html).not.toContain("Ticket:");
  expect(html).not.toContain("oportunidades priorizadas");
});

test("analysis proposals keep Apply visible and full before/after changes collapsed", () => {
  const html = renderToStaticMarkup(<ActionCard action={action} refs={{}} disabled={false} onAction={jest.fn()} compact />);
  expect(html).toMatch(/<details[^>]*><summary[^>]*>Ver alterações<\/summary>/);
  expect(html).not.toMatch(/<details[^>]*open/);
  expect(html).toContain("Antes:");
  expect(html).toContain("Depois:");
  expect(html.indexOf(">Aplicar<")).toBeGreaterThan(html.indexOf("</details>"));
  const normal = renderToStaticMarkup(<ActionCard action={action} refs={{}} disabled={false} onAction={jest.fn()} />);
  expect(normal).not.toContain("Ver alterações");
  expect(normal).toContain(action.title);
  expect(normal).toContain(action.reason);
});

test("potential uses Brazilian numbers and one explanation without repeating the formula", () => {
  const html = renderToStaticMarkup(<DataCard card={{ ...potential, type: "potential" }} />);
  expect(html).toContain("+0,6%");
  expect(html).toContain("28,80");
  expect(html).toContain("próximas 4 semanas");
  expect(html).toContain(potential.assumptions);
  expect(html).not.toContain(potential.formula);
  expect(html).not.toMatch(/<details[^>]*open/);
});
