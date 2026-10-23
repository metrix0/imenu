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

test("iMenu Plus has exclusive support and precedes the QR card in the two-column grid", () => {
    const html = renderToStaticMarkup(<MenuProductCards qrSelected={false} onLearnMore={noop} extraCard={<IaPlusProductCard active={false} onLearnMore={noop} />} />);
    expect(html).toContain('class="panel-product-cards grid gap-5 md:grid-cols-2"');
    expect(html).not.toContain("xl:grid-cols-3");
    expect(html.indexOf('alt="iMenu Plus"')).toBeLessThan(html.indexOf('alt="iMenu QR Code Mesa"'));
    expect(html).toContain("Marketing pelo WhatsApp e inteligência artificial para vender mais.");
    const iaCard = html.slice(html.indexOf('aria-label="Conhecer iMenu Plus"'));
    expect(iaCard).toMatch(/class="text-2xl font-bold">R\$\s49,99/);
    expect(iaCard).toContain('title="Assistente IA"');
    expect(iaCard).toContain('title="Automações de Marketing WhatsApp"');
    expect(iaCard).toContain('title="iMenu QR Code (Incluso)"');
    expect(iaCard).toContain("Ver tudo que o sistema faz");
    expect(iaCard).toContain("Saiba mais");
    expect(iaCard).toContain("Bônus");
    expect(iaCard).toContain('data-ui="badge"');
    expect(iaCard).not.toContain("Solicite integrações e novas funcionalidades em até 3 dias úteis.");
    expect(iaCard).toContain("Atendimento exclusivo");
    expect(iaCard).toContain("Download Cardápio em PDF");
    const qrCard = html.slice(html.indexOf('alt="iMenu QR Code Mesa"'));
    expect(qrCard).not.toContain("Atendimento Exclusivo");
});
