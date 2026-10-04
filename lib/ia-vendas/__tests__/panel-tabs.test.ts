import { PANEL_TAB_KEYS, PANEL_TABS, isPanelTabKey } from "../panelTabs";

test("assistant panel tabs only point to existing painel routes", () => {
  expect(PANEL_TAB_KEYS).toContain("cardapio");
  expect(PANEL_TAB_KEYS).toContain("configuracoes");
  expect(PANEL_TABS.horarios.href).toBe("/painel/disponibilidade");
  expect(PANEL_TABS["taxa-e-tempo"].href).toBe("/painel/tempo-e-taxa");
  expect(PANEL_TAB_KEYS.every((key) => PANEL_TABS[key].href.startsWith("/painel"))).toBe(true);
});

test("panel tab validation rejects arbitrary routes", () => {
  expect(isPanelTabKey("cardapio")).toBe(true);
  expect(isPanelTabKey("/painel/cardapio")).toBe(false);
  expect(isPanelTabKey("javascript:alert(1)")).toBe(false);
});
