import { renderToStaticMarkup } from "react-dom/server";
import MenuProductCards from "../MenuProductCards";
import IaPlusProductCard from "@/components/restaurant-owner/ia-vendas/IaPlusProductCard";

const noop = () => {};
test("QR cards stay free in every state", () => {
    const html = renderToStaticMarkup(<MenuProductCards qrSelected={false} onLearnMore={noop} />);
    expect(html).toContain("Cardápio digital nas mesas com QR Code, sem cobrança.");
    expect(html).toContain("Grátis para sempre, sem limites");
    expect(html).toContain("Painel Garçom");
    expect(html).not.toContain("R$ 5,00");
});
test("IA Plus has exclusive support and precedes the QR card in the two-column grid", () => {
    const html = renderToStaticMarkup(<MenuProductCards qrSelected={false} onLearnMore={noop} extraCard={<IaPlusProductCard active={false} onLearnMore={noop} />} />);
    expect(html).toContain('class="panel-product-cards grid gap-5 md:grid-cols-2"');
    expect(html).not.toContain("xl:grid-cols-3");
    expect(html.indexOf('alt="iMenu IA Plus"')).toBeLessThan(html.indexOf('alt="iMenu QR Code Mesa"'));
    expect(html).toContain("Assistente IA com capacidade total! Acesso completo às Análise de vendas com IA!");
    const iaCard = html.slice(html.indexOf('aria-label="Conhecer iMenu IA Plus"'));
    expect(iaCard).toMatch(/class="text-2xl font-bold">R\$\s49,99/);
    expect(iaCard).toContain('title="Assistente IA"');
    expect(iaCard).toContain('title="Geração de imagens"');
    expect(iaCard).toContain('title="Análise completa"');
    expect(iaCard).toContain("Ver tudo que o sistema faz");
    expect(iaCard).toContain("Saiba mais");
    expect(iaCard).toContain("BÔNUS: Atendimento Exclusivo");
    expect(iaCard).toContain('data-ui="badge"');
    expect(iaCard).not.toContain("Solicite integrações e novas funcionalidades em até 3 dias úteis.");
    expect(iaCard).toContain("Durante sua assinatura do iMenu IA Plus, solicite integrações e novas funcionalidades para serem adicionadas em até 3 dias úteis.");
    const qrCard = html.slice(html.indexOf('alt="iMenu QR Code Mesa"'));
    expect(qrCard).not.toContain("Atendimento Exclusivo");
});
