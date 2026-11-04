import { renderToStaticMarkup } from "react-dom/server";
import ErrorNoticeContent from "@/components/restaurant-owner/ia-vendas/ErrorNoticeContent";

jest.mock("@/components/ui/Button", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));
jest.mock("@/components/common/SupportButton", () => ({
  SupportWhatsappBadge: () => <a href="https://wa.me/5519997235394">Suporte WhatsApp</a>,
}));

test("monthly limit includes the reset time, buy-more action and WhatsApp support", () => {
  const html = renderToStaticMarkup(
    <ErrorNoticeContent
      message="Limite mensal de IA atingido. Limites serão reiniciados em 30/11 às 21:00."
      onBuyCredits={() => {}}
    />,
  );
  expect(html).toContain("Limites serão reiniciados em 30/11 às 21:00");
  expect(html).toContain("Comprar mais créditos");
  expect(html).toContain("Suporte WhatsApp");
  expect(html.indexOf("Limites serão reiniciados")).toBeLessThan(html.indexOf("Comprar mais créditos"));
  expect(html).toContain("https://wa.me/5519997235394");
});

test("generic capacity errors retain only existing support contact", () => {
  const html = renderToStaticMarkup(
    <ErrorNoticeContent
      message="A IA atingiu a capacidade disponível. Tente novamente mais tarde. Caso precise de mais limite ou ajuda, entre em contato com o suporte."
      onBuyCredits={() => {}}
    />,
  );
  expect(html).toContain("Suporte WhatsApp");
  expect(html).not.toContain("Comprar mais créditos");
});

test("unrelated errors do not show purchase or support controls", () => {
  const html = renderToStaticMarkup(
    <ErrorNoticeContent message="Conexão interrompida." onBuyCredits={() => {}} />,
  );
  expect(html).toContain("Conexão interrompida.");
  expect(html).not.toContain("Comprar mais créditos");
  expect(html).not.toContain("Suporte WhatsApp");
});
