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
    expect(html).toContain("Venda mais com iMenu Plus.");
    const iaCard = html.slice(html.indexOf('aria-label="Conhecer iMenu Plus"'));
    expect(iaCard).toMatch(/class="text-2xl font-bold">R\$\s49,99/);
    expect(iaCard).toContain('title="Assistente IA"');
    expect(iaCard).toContain('title="Automações de Marketing WhatsApp"');
    expect(iaCard).toContain('title="Vendas IA"');
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


test("The included iMenu card lists the three free features in order", () => {
    const html = renderToStaticMarkup(<MenuProductCards presentation="plans" qrSelected={false} onLearnMore={noop} />);
    const freeFeatures = html.slice(html.indexOf('<h3>iMenu</h3>'));
    expect(freeFeatures).toMatch(/Robô WhatsApp[\s\S]*Pedidos delivery[\s\S]*QR Code Mesa/);
    expect(freeFeatures).not.toContain("Gestão de pedidos");
});

test("Planos shows one free base plan and a full-width Plus plan without a separate QR card", () => {
    const html = renderToStaticMarkup(<MenuProductCards presentation="plans" qrSelected={false} onLearnMore={noop} extraCard={<IaPlusProductCard presentation="plans" active={false} onLearnMore={noop} />} />);
    expect(html.match(/class="plans-included"/g)).toHaveLength(1);
    expect(html).toContain("<h3>iMenu</h3>");
    expect(html).toContain("Seu cardápio delivery com produtos, pedidos e gestão pelo painel.");
    expect(html).not.toContain("iMenu Cardápio Digital");
    expect(html).toContain("Venda mais com iMenu Plus.");
    expect(html).toContain("IAPlusCombinationMarkLogo_Brand.png");
    expect(html).not.toContain("iMenu QR Code Mesa");
    expect(html).toContain("Atualizações de pedidos pelo WhatsApp");
    expect(html).toContain("Scan de cardápio com IA");
    expect(html).not.toContain("Já gratuitos em qualquer plano");
    expect(html).toContain("plans-plus-bonus-grid");
    expect(html).not.toContain("plans-plus-footer");
    expect(html).toContain("plans-plus-feature-icon");
    expect(html).not.toContain("Recursos principais");
    expect(html).toContain("plans-plus-bonus-icon");
});
