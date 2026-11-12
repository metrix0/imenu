import { renderToStaticMarkup } from "react-dom/server";
import SalesPage from "@/app/painel/IAVendasPage";
import { useSalesStore } from "@/lib/stores/restaurant-owner/iaVendasStore";

jest.mock("@/lib/stores/restaurant-owner/iaVendasStore", () => ({ useSalesStore: jest.fn() }));
jest.mock("@/lib/stores/restaurant-owner/creationStore", () => ({
  useCreationStore: (select: any) => select({ restaurantId: "owner" }),
}));
jest.mock("next/navigation", () => ({ usePathname: () => "/painel/assistente-ia", useParams: () => ({}) }));
jest.mock("@/lib/analytics/plusExposure", () => ({ usePlusExposure: jest.fn() }));
jest.mock("@/lib/api/instrumentation-client", () => ({ capturePosthogLightweight: jest.fn() }));
jest.mock("@/components/restaurant-owner/ia-vendas/IaPlusSalesModal", () => ({
  __esModule: true, default: () => null, IaPlusLimitMessage: () => null,
}));
jest.mock("@/components/restaurant-owner/ia-vendas/AiUsage", () => () => null);
jest.mock("@/components/restaurant-owner/ia-vendas/CreditPurchaseCalculator", () => () => null);
jest.mock("@/components/restaurant-owner/ia-vendas/AnalysisReport", () => () => null);
jest.mock("@/components/common/SupportButton", () => ({ SupportWhatsappBadge: () => null }));
jest.mock("@/components/restaurant-owner/ia-vendas/SalesWidgets", () => ({
  ActionCard: ({ action }: any) => <div data-action={action.id}>{action.title}</div>,
  ActionPreview: () => null,
  DataCard: () => null,
}));

const id = "e87710cd-6ebd-42c0-a3b9-e5b844ce1c94";

function renderReply(content: string, known = true) {
  (useSalesStore as unknown as jest.Mock).mockReturnValue({
    access: { plus: true }, conversations: [{ id: "chat", kind: "chat", title: "Imagens" }],
    conversation_id: "chat", analyses: [], actions: known ? [{ id, title: "Atualizar imagem: Açaí", status: "pending" }] : [],
    messages: [{ id: "message", role: "assistant", content, cards: known ? [{ type: "action", id }] : [] }],
    references: {}, instructions: "", loading: false, busy: false, acting: false,
  });
  return renderToStaticMarkup(<SalesPage />);
}

test.each(["action", "image", "preview"])("%s markers render the existing image card once", (marker) => {
  const html = renderReply(`Preparei a prévia. [[${marker}:${id}]] Fim.`);
  expect(html).not.toContain(`[[${marker}:`);
  expect(html.match(/data-action=/g)).toHaveLength(1);
  expect(html.indexOf("Preparei a prévia.")).toBeLessThan(html.indexOf("data-action="));
  expect(html.indexOf("data-action=")).toBeLessThan(html.indexOf("Fim."));
});

test("repeated aliases do not duplicate a card and unknown previews do not leak", () => {
  expect(renderReply(`[[preview:${id}]] [[action:${id}]]`).match(/data-action=/g)).toHaveLength(1);
  expect(renderReply(`Prévia [[preview:${id}]]`, false)).not.toContain("[[preview:");
});
