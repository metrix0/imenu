import fs from "fs";
import path from "path";

test("Vendas IA keeps the shared panel shell layout stable", () => {
  const panelCss = fs.readFileSync(
    path.join(process.cwd(), "app/painel/essencial.css"),
    "utf8",
  );
  const page = fs.readFileSync(
    path.join(process.cwd(), "app/painel/IAVendasPage.tsx"),
    "utf8",
  );

  expect(panelCss).not.toContain(
    'data-panel-path^="/painel/vendas-ia"',
  );
  expect(page).toContain(
    '"h-[calc(100dvh-112px)] max-h-[calc(100dvh-112px)] min-h-0 w-full overflow-hidden md:h-[calc(100dvh-64px)] md:max-h-[calc(100dvh-64px)]"',
  );
});
