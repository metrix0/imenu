import { IA_PLUS_BENEFITS, IA_PLUS_BONUSES, getIMenuPlusExpiryFeatures } from "@/lib/addons/products";
import { buildExpiryMessage } from "./addonExpiryMessage";

it.each([
    ["Pix", { pix: ["ia_plus"], card: [] }, "A renovação via Pix não é automática."],
    ["cartão cancelado", { pix: [], card: ["ia_plus"] }, "Sua assinatura no cartão foi cancelada"],
])("informa o vencimento de %s e todas as funcionalidades do catálogo", (_method, products, notice) => {
    const message = buildExpiryMessage(products);
    expect(message).toContain("iMenu Plus* vence amanhã");
    expect(message).toContain(notice);
    const { benefits, bonuses } = getIMenuPlusExpiryFeatures();
    expect(benefits).toHaveLength(IA_PLUS_BENEFITS.length);
    expect(bonuses).toHaveLength(IA_PLUS_BONUSES.length);
    for (const item of [...benefits, ...bonuses]) {
        expect(message).toContain(`• ${item.title}`);
    }
    expect(message).not.toContain("1 dia de tolerância");
    expect(message).not.toContain("QR Code Mesa");
    expect(message).toContain("imenuapp.com.br/painel/configuracoes");
});

it("não gera lembrete sem Plus", () => {
    expect(buildExpiryMessage({ pix: [], card: [] })).toBe("");
});
