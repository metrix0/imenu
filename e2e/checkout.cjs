#!/usr/bin/env node
// Browser E2E against the real production build, with isolated network fixtures.
// No real Supabase data, orders, payments, or customer notifications.
const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const puppeteer = require("puppeteer");

const BASE = "http://127.0.0.1:39202";
const SUPABASE_PORT = 39201;
const restaurantId = "30000000-0000-4000-8000-000000000001";
const categoryId = "40000000-0000-4000-8000-000000000001";
const itemId = "10000000-0000-4000-8000-000000000001";
const orderId = "50000000-0000-4000-8000-000000000001";
const daily = Object.fromEntries(Array.from({ length: 7 }, (_, i) =>
    [String(i), [{ open: "00:00", close: "23:59" }]]));
const data = {
    restaurants: [{
        id: restaurantId, url_slug: "e2e-restaurant", name: "Restaurante E2E",
        description: "Isolated test fixture", is_closed: null, first_time: false,
        logo_url: null, banner_url: null, rating: 5, min_order_cents: 0,
        availability_json: daily, delivery_fee_json: [], delivery_fee_mode: "radius",
        delivery_neighborhood_fee_json: [], latitude: 0, longitude: 0,
        allowed_payment_methods: ["pix", "dinheiro", "trazer-maquininha"],
        address: {}, store_whatsapp: null, pickup_enabled: true,
        delivery_disabled: true, force_whatsapp_order_confirmation: false,
        preorder_only: false, preorder_availability_json: null, preorder_min_days: 0,
        allow_future_order_scheduling: false, automatic_promotions: [],
        pizza_settings: null, vitrine_enabled: false
    }],
    categories: [{ id: categoryId, name: "Lanches", position: 0, availability_schedule: null }],
    items: [{
        id: itemId, name: "Hambúrguer E2E", description: "Produto de teste",
        price_cents: 2500, image_path: null, is_available: true,
        position: 0, category_id: categoryId,
        category: { id: categoryId, name: "Lanches", position: 0 }
    }],
    loyalty_programs: [{ active: false }],
    tracking_integrations: [],
    promotions: [],
    item_subcategories: [],
    subitems: []
};

function server() {
    return http.createServer((req, res) => {
        const url = new URL(req.url, "http://127.0.0.1");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "apikey, authorization, content-type, x-client-info, prefer");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
        if (req.method === "OPTIONS") return res.writeHead(204).end();
        if (url.pathname === "/auth/v1/signup" && req.method === "POST") {
            res.setHeader("Content-Type", "application/json");
            return res.end(JSON.stringify({
                user: {
                    id: "60000000-0000-4000-8000-000000000001",
                    aud: "authenticated", role: "authenticated",
                    email: "e2e@example.invalid",
                    created_at: "2026-01-01T00:00:00Z"
                },
                session: null
            }));
        }
        if (url.pathname === "/auth/v1/settings") {
            res.setHeader("Content-Type", "application/json");
            return res.end(JSON.stringify({ external: {}, disable_signup: false }));
        }
        if (!url.pathname.startsWith("/rest/v1/")) return res.writeHead(404).end();
        const table = url.pathname.split("/").at(-1);
        if (!Object.hasOwn(data, table)) return res.writeHead(404).end();
        let rows = data[table];
        if (url.searchParams.get("url_slug") && url.searchParams.get("url_slug") !== "eq.e2e-restaurant") rows = [];
        const single = String(req.headers.accept || "").includes("application/vnd.pgrst.object+json");
        const result = single ? (rows[0] || null) : rows;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify(result));
    });
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function ready(url, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
            if (response.ok) return;
        } catch {}
        await pause(350);
    }
    throw new Error("Timed out starting browser fixture: " + url);
}

async function click(page, text) {
    await page.waitForFunction(value =>
        [...document.querySelectorAll("button")].some(button =>
            !button.disabled && button.offsetWidth > 0 &&
            button.textContent.trim().includes(value)
        ), { timeout: 15000 }, text);
    const buttons = await page.$$("button");
    for (const button of buttons) {
        const matching = await button.evaluate((element, value) =>
            !element.disabled && element.offsetWidth > 0 &&
            element.textContent.trim().includes(value), text);
        if (matching) {
            await button.click();
            return;
        }
    }
    throw new Error("Button not clickable: " + text);
}

async function signup(browser) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    let emailChecked = false;
    await page.setRequestInterception(true);
    page.on("request", request => {
        const url = new URL(request.url());
        if (url.origin === BASE && url.pathname === "/api/auth/email-exists") {
            emailChecked = true;
            return request.respond({
                status: 200, contentType: "application/json",
                body: JSON.stringify({ exists: false })
            });
        }
        return request.continue();
    });
    try {
        const response = await page.goto(BASE + "/restaurante/registrar", { waitUntil: "networkidle2" });
        assert.equal(response.status(), 200);
        await click(page, "Criar Conta Grátis");
        await page.waitForFunction(() => document.body.textContent.includes("Falta preencher:"));
        await page.type('input[autocomplete="email"]', "e2e@example.invalid");
        await page.type('input[autocomplete="tel"]', "11999990000");
        await page.type('input[autocomplete="new-password"]', "FixtureOnly123");
        await page.click('input[type="checkbox"]');
        await click(page, "Criar Conta Grátis");
        await page.waitForFunction(() => location.pathname === "/restaurante/criar/info/otp", { timeout: 15000 });
        assert.ok(emailChecked, "Signup must verify the email before requesting Supabase Auth");
        console.log("PASS signup validation → email verification → mocked auth signup → OTP");
    } finally {
        await context.close();
    }
}

async function flow(browser, method) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    let orderPayload;
    await page.setRequestInterception(true);
    page.on("request", request => {
        const url = new URL(request.url());
        if (url.origin === BASE && url.pathname === "/api/orders" && request.method() === "POST") {
            orderPayload = JSON.parse(request.postData());
            return request.respond({
                status: 200, contentType: "application/json",
                body: JSON.stringify({
                    id: orderId, payment_type: "online",
                    init_point: BASE + "/restaurante/login"
                })
            });
        }
        if (url.origin === BASE && /^\/api\/items\/[^/]+\/subcategories$/.test(url.pathname)) {
            return request.respond({ status: 200, contentType: "application/json", body: "[]" });
        }
        if (url.origin === BASE && url.pathname === "/api/checkout/delivery-config") {
            return request.respond({
                status: 200, contentType: "application/json",
                body: JSON.stringify({ mode: "radius", rules: [] })
            });
        }
        if (url.origin === BASE && url.pathname === "/api/meta") {
            return request.respond({ status: 200, contentType: "application/json", body: "{}" });
        }
        return request.continue();
    });
    try {
        const response = await page.goto(BASE + "/e2e-restaurant", { waitUntil: "networkidle2" });
        assert.equal(response.status(), 200, "Menu route must load");
        await page.waitForFunction(() => document.body.textContent.includes("Hambúrguer E2E"));
        await click(page, "Hambúrguer E2E");
        await click(page, "Adicionar");
        await click(page, "Ver Sacola");
        await click(page, "Continuar");
        await page.waitForSelector('input[autocomplete="name"]');
        await page.type('input[autocomplete="name"]', "Cliente E2E");
        await page.type('input[autocomplete="tel"]', "11999990000");
        await click(page, "Continuar");
        await page.waitForFunction(() => document.body.textContent.includes("Pagamento"));
        await click(page, method === "pix" ? "Pix (Online)" : "Dinheiro");
        await click(page, "Confirmar");
        await page.waitForFunction(() => location.pathname === "/restaurante/login", { timeout: 15000 });
        assert.ok(orderPayload, "Checkout must submit to the real order API boundary");
        assert.equal(orderPayload.restaurantId, restaurantId);
        assert.equal(orderPayload.is_delivery, "retirada");
        assert.equal(orderPayload.paymentMethod, method);
        assert.equal(orderPayload.customer_name, "Cliente E2E");
        assert.equal(orderPayload.customer_phone.replace(/\D/g, ""), "11999990000");
        assert.equal(orderPayload.subtotal_cents, 2500);
        assert.equal(orderPayload.delivery_fee_cents, 0);
        assert.equal(orderPayload.items.length, 1);
        assert.equal(orderPayload.items[0].base_item_id, itemId);
        console.log("PASS menu → cart → pickup checkout → " + method + " (order/payment API simulated)");
    } finally {
        await context.close();
    }
}

async function run() {
    const mock = server();
    await new Promise((resolve, reject) => mock.once("error", reject)
        .listen(SUPABASE_PORT, "127.0.0.1", resolve));
    const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start",
        "-H", "127.0.0.1", "-p", "39202"], { stdio: ["ignore", "pipe", "pipe"] });
    let lastLogs = "";
    next.stdout.on("data", chunk => { lastLogs = (lastLogs + chunk).slice(-4000); });
    next.stderr.on("data", chunk => { lastLogs = (lastLogs + chunk).slice(-4000); });
    let browser;
    try {
        await ready(BASE + "/e2e-restaurant", 30000);
        browser = await puppeteer.launch({
            headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: ["--no-sandbox", "--disable-dev-shm-usage"]
        });
        await signup(browser);
        await flow(browser, "dinheiro");
        await flow(browser, "pix");
    } catch (error) {
        console.error(lastLogs);
        throw error;
    } finally {
        await browser?.close();
        next.kill("SIGTERM");
        await new Promise(resolve => mock.close(resolve));
    }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
