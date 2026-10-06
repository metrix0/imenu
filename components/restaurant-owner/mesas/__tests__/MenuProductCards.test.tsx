import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import MenuProductCards from "../MenuProductCards";
import IaPlusProductCard from "@/components/restaurant-owner/ia-vendas/IaPlusProductCard";

const noop = () => {};
// Captured from the original two cards on preview, before extracting MenuProductCard.
// Preserve every rendered element, text, class and attribute in all existing states.
const baselines = [
    [{ qrSelected: false }, "158d5bacf3dcd4499de4e7ad491cdbbeb51940d23d1db753e62f2c0b9a15a342"],
    [{ qrSelected: true }, "a693810bcacbddf8a5c8c62ba1c68ad4d0ff082268f1c59e02d762d1eaf4e696"],
    [{ qrSelected: false, qrActive: true }, "479704ea0bf835420b6d2f4e28ec7535c967d302bb2e32ecf7863d76e15cf529"],
    [{ qrSelected: false, onQrToggle: noop }, "9d8f383de3bc90f5315a9ce85bea99c3b180612396f8f4879f25700752c1486b"],
    [{ qrSelected: true, onQrToggle: noop }, "e980ac3d186c55c40545642ffa0a65cde4defa9fa308cca9a0d4a62aa2084a15"],
] as const;

test.each(baselines)("preserves the original cards with state %j", (props, hash) => {
    const html = renderToStaticMarkup(<MenuProductCards {...props} onLearnMore={noop} />)
        .replace(/class="([^"]*)"/g, (_, classes) => `class="${classes.trim()}"`);
    expect(createHash("sha256").update(html).digest("hex")).toBe(hash);
});

test("IA Plus follows the first two cards in the two-column grid with the requested copy", () => {
    const html = renderToStaticMarkup(<MenuProductCards qrSelected={false} onLearnMore={noop} extraCard={<IaPlusProductCard active={false} onLearnMore={noop} />} />);
    expect(html).toContain('class="panel-product-cards grid gap-5 md:grid-cols-2"');
    expect(html).not.toContain("xl:grid-cols-3");
    expect(html.indexOf('alt="iMenu IA Plus"')).toBeGreaterThan(html.indexOf('alt="iMenu QR Code Mesa"'));
    expect(html).toContain("Assistente IA liberado e com mais capacidade. Acesso completo às oportunidades da Análise de vendas com IA!");
    const iaCard = html.slice(html.indexOf('aria-label="Conhecer iMenu IA Plus"'));
    expect(iaCard).toMatch(/class="text-2xl font-bold">R\$\s49,99/);
    expect(iaCard).toContain('title="Assistente IA"');
    expect(iaCard).toContain('title="Geração de imagens"');
    expect(iaCard).toContain('title="Análise completa"');
    expect(iaCard).toContain("Ver tudo que o sistema faz");
    expect(iaCard).toContain("Saiba mais");
});
