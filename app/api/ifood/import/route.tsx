import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

// helper pra substituir page.waitForTimeout
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Scroll automático pra tentar carregar tudo
async function autoScroll(page: any) {
    console.log("📜 [autoScroll] Iniciando scroll automático...");
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 400;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight - 200) {
                    clearInterval(timer);
                    resolve();
                }
            }, 200);
        });
    });
    console.log("📜 [autoScroll] Scroll finalizado.");
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const url = body.url;

        if (!url) {
            return NextResponse.json(
                { error: "URL ausente no body." },
                { status: 422 }
            );
        }

        console.log("🚀 INICIANDO SCRAPER IFood");
        console.log("🌐 URL:", url);

        const browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari"
        );

        console.log("📄 Acessando página...");
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

        console.log("⏳ Aguardando fast-menu (.restaurant-menu__fast-menu)...");
        try {
            await page.waitForSelector(".restaurant-menu__fast-menu", {
                timeout: 20000,
            });
            console.log("✅ Fast-menu encontrado.");
        } catch (e) {
            console.log(
                "⚠️ Fast-menu NÃO encontrado. Pode ser layout diferente ou mudança no iFood."
            );
        }

        // scroll pra carregar lazy
        await autoScroll(page);

        console.log("🔍 Buscando botões de categoria no fast-menu...");
        const categoryButtons = await page.$$(".restaurant-menu__fast-menu button");
        console.log(
            `📌 [DEBUG] Botões de categoria encontrados: ${categoryButtons.length}`
        );

        console.log("🖱️ Clicando em cada categoria (se existir)...");
        for (let i = 0; i < categoryButtons.length; i++) {
            console.log(`➡️ Clicando categoria ${i + 1}/${categoryButtons.length}`);
            try {
                await categoryButtons[i].click();
                await sleep(1500); // antes era page.waitForTimeout(1500)
            } catch (err) {
                console.log(`❌ Erro ao clicar categoria ${i + 1}:`, err);
            }
        }

        console.log("⏳ Aguardando renderização dos itens (sleep 3s)...");
        await sleep(3000); // antes era page.waitForTimeout(3000)

        console.log("🧩 Extraindo dados do DOM...");

        const scraped = await page.evaluate(() => {
            const result: any = { categorias: [], itensSoltos: 0 };

            // tentativa 1: blocos de categoria clássicos
            const categoryBlocks = document.querySelectorAll(
                ".dish-group, .dish-card-group, [data-test-id='dish-group']"
            );

            // fallback: tentar por títulos
            const headerWrappers = document.querySelectorAll(
                ".restaurant-menu__header-wrapper"
            );

            const usados = new Set<HTMLElement>();

            const pushCategoria = (nome: string, root: HTMLElement | ParentNode) => {
                const cards =
                    (root as HTMLElement).querySelectorAll(".dish-card") || [];
                const itens = Array.from(cards).map((el: any) => ({
                    nome: el.querySelector("h3")?.textContent?.trim() || "",
                    desc: el.querySelector("p")?.textContent?.trim() || "",
                    preco:
                        el.querySelector("[class*=price]")?.textContent?.trim() || "" ||
                        el.querySelector("[data-test-id*=price]")
                            ?.textContent?.trim() ||
                        "",
                    img: el.querySelector("img")?.src || "",
                }));

                result.categorias.push({
                    nome: nome || "Sem nome",
                    itens,
                });

                result.itensSoltos += itens.length;
            };

            // 1) blocos de categoria
            categoryBlocks.forEach((block: any, idx) => {
                usados.add(block);
                const titleEl =
                    block.querySelector("h2") ||
                    block.querySelector("h3") ||
                    block.querySelector("[data-test-id*=category]");
                const nomeCategoria =
                    titleEl?.textContent?.trim() || `Categoria #${idx + 1}`;
                pushCategoria(nomeCategoria, block);
            });

            // 2) fallback: headers do menu
            if (result.categorias.length === 0 && headerWrappers.length > 0) {
                headerWrappers.forEach((header: any, idx) => {
                    const nomeCategoria =
                        header.textContent?.trim() || `Header #${idx + 1}`;
                    const container =
                        header.parentElement?.parentElement ||
                        header.parentElement ||
                        header;
                    pushCategoria(nomeCategoria, container);
                });
            }

            return result;
        });

        console.log("🔥 SCRAP FINAL:");
        console.log(JSON.stringify(scraped, null, 2));

        console.log("🔚 Fechando navegador...");
        await browser.close();

        console.log("✔️ FINALIZADO.");

        // por enquanto, NADA de banco — só retorno + log
        return NextResponse.json(
            {
                status: "ok",
                message: "Scrape executado com sucesso.",
                scraped,
            },
            { status: 200 }
        );
    } catch (err: any) {
        console.log("❌ ERRO GERAL:", err);
        return NextResponse.json(
            { error: err.message, stack: err.stack },
            { status: 500 }
        );
    }
}
