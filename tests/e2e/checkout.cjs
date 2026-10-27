#!/usr/bin/env node
// Browser E2E against the real production build, with isolated network fixtures.
// No real Supabase data, orders, payments, or customer notifications.
const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const puppeteer = require("puppeteer");
const fs = require("node:fs");
const path = require("node:path");
const screenshotDir = process.env.E2E_SCREENSHOT_DIR;
async function screenshot(page,name) {
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=="running" || a.effect?.getComputedTiming().iterations===Infinity),{timeout:5000});
    if(screenshotDir) {fs.mkdirSync(screenshotDir,{recursive:true});await page.screenshot({path:path.join(screenshotDir,name+".png"),fullPage:false});}}

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
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
        let target;
        try {
            // Keep the element found by the wait: querying again can race with React renders.
            // aria-disabled is how the item modal signals that it is still loading.
            target = await page.waitForFunction(value =>
                [...document.querySelectorAll("button")].find(button =>
                    !button.disabled && button.getAttribute("aria-disabled") !== "true" &&
                    button.offsetWidth > 0 && button.textContent.trim().includes(value)
                ) || false, { timeout: Math.max(1, deadline - Date.now()) }, text);
        } catch (error) {
            const candidates = await page.evaluate(value =>
                [...document.querySelectorAll("button")]
                    .filter(button => button.textContent.trim().includes(value))
                    .map(button => ({
                        text: button.textContent.trim().slice(0, 80),
                        disabled: button.disabled,
                        ariaDisabled: button.getAttribute("aria-disabled"),
                        visible: button.offsetWidth > 0
                    })), text);
            throw new Error(`Button "${text}" unavailable; matches: ${JSON.stringify(candidates)}`, { cause: error });
        }

        try {
            const element = target.asElement();
            if (!element) throw new Error("Expected button element: " + text);
            await element.click();
            return;
        } catch (error) {
            // The component may rerender between finding the button and clicking it.
            // Retry only when Puppeteer reports that the element has detached or moved.
            if (!/detached|not visible|not clickable|outside of the viewport/i.test(String(error))) throw error;
            await pause(100);
        } finally {
            await target.dispose();
        }
    }
    throw new Error("Button not clickable before timeout: " + text);
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
        if (url.origin === BASE && url.pathname === "/api/checkout/customer") {
            return request.respond({status:200,contentType:"application/json",body:JSON.stringify({needsVerification:true})});
        }
        if (url.origin === BASE && url.pathname === "/api/checkout/session") {
            return request.respond({status:200,contentType:"application/json",body:'{"ok":true}'});
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
        // The item modal closes after an animation. Wait for its overlay to leave
        // before clicking the cart button beneath it, or the click hits the backdrop.
        await page.waitForFunction(() =>
            !document.querySelector('[role="dialog"], [data-ui="sheet"]'),
            { timeout: 15000 });
        await click(page, "Ver Sacola");
        await click(page, "Continuar");
        await page.waitForSelector('input[autocomplete="name"]');
        const phoneFirst = await page.evaluate(() => Boolean(document.querySelector('input[autocomplete="tel"]').compareDocumentPosition(document.querySelector('input[autocomplete="name"]')) & Node.DOCUMENT_POSITION_FOLLOWING));
        assert.ok(phoneFirst,"Phone must come before name in checkout");
        await page.type('input[autocomplete="name"]', "Cliente E2E");
        await page.type('input[autocomplete="tel"]', "11999990000");
        await screenshot(page,"checkout-"+method);
        assert.ok(await page.evaluate(()=>{const input=document.querySelector('input[autocomplete="tel"]').getBoundingClientRect();return input.left>=0 && input.right<=innerWidth;}),"Phone input must stay fully visible after checkout reordering");
        await click(page, "Continuar");
        await page.waitForFunction(() => document.body.textContent.includes("Pagamento"));
        await screenshot(page,"checkout-payment-"+method);
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

async function crmPanels(browser) {
    const context=await browser.createBrowserContext(),page=await context.newPage();
    await page.setViewport({width:1280,height:900});
    const user={id:"60000000-0000-4000-8000-000000000001",aud:"authenticated",role:"authenticated",email:"e2e@example.invalid"};
    const token=Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url")+"."+Buffer.from(JSON.stringify({sub:user.id,aud:"authenticated",exp:Math.floor(Date.now()/1000)+3600})).toString("base64url")+".testsignature";
    await page.evaluateOnNewDocument(({user,token,restaurantId})=>{
        localStorage.setItem("sb-127-auth-token",JSON.stringify({access_token:token,refresh_token:"fixture",token_type:"bearer",expires_at:Math.floor(Date.now()/1000)+3600,user}));
        localStorage.setItem("restaurant-creation-storage",JSON.stringify({state:{restaurantId,email:user.email,productSelectionCompleted:true,restaurantSlug:"e2e-restaurant"},version:0}));
        sessionStorage.setItem("imenu-creation-complete:"+user.id,"true");
    },{user,token,restaurantId});
    const customer={phone:"5511999990000",name:"Cliente CRM",address:{rua:"Rua de teste",numero:"123",bairro:"Centro"},marketing_consent:true,opted_out_at:null,order_count:3,spending_cents:15000,average_ticket_cents:5000,last_purchase:new Date().toISOString(),segment:"Frequente"};
    let saved=null;
    const settings=Object.fromEntries(["cart","reactivation","habit"].map(kind=>[kind,{enabled:false,message:"Oi, {{nome}}! Vamos pedir na {{restaurante}}?",days:30,dailyLimit:kind==="cart"?7:2,cooldownDays:kind==="reactivation"?120:7,offer:""}]));
    await page.setRequestInterception(true);
    page.on("request",request=>{
        const url=new URL(request.url());
        if(url.origin===BASE && url.pathname==="/api/customers") return request.respond({status:200,contentType:"application/json",body:JSON.stringify(url.searchParams.has("phone") ? {customer,orders:[{id:orderId,display_id:42,status:"done",total_cents:5000,created_at:customer.last_purchase}],favorites:[{item_id:itemId,name:"Hambúrguer favorito",quantity:3}]} : {customers:[customer],total:1})});
        if(url.origin===BASE && url.pathname==="/api/automations") {
            if(request.method()==="PUT") saved=JSON.parse(request.postData());
            return request.respond({status:200,contentType:"application/json",body:JSON.stringify(request.method()==="PUT" ? {settings:saved} : {settings,offers:[{value:"coupon:10000000-0000-4000-8000-000000000001",label:"Cupom: VOLTE10"}],connected:true})});
        }
        if(url.origin===BASE && url.pathname.startsWith("/api/")) return request.respond({status:200,contentType:"application/json",body:JSON.stringify({connection:null,notices:[],items:[]})});
        return request.continue();
    });
    try {
        await page.goto(BASE+"/painel/clientes",{waitUntil:"networkidle2"});
        await page.waitForFunction(()=>document.body.textContent.includes("Cliente CRM"));
        assert.ok((await page.content()).includes("Frequente"));
        await screenshot(page,"clientes-desktop");
        await page.locator('input[placeholder="Nome ou celular"]').fill("Cliente");
        await page.waitForFunction(()=>document.body.textContent.includes("Cliente CRM"));
        await page.waitForFunction(()=>Array.from(document.querySelectorAll('tbody tr')).some(row=>row.textContent.includes('Cliente CRM')));
        await page.locator('tbody tr').click();
        await page.waitForFunction(()=>document.body.textContent.includes("Hambúrguer favorito"));
        await screenshot(page,"cliente-historico");
        await page.goto(BASE+"/painel/automacoes",{waitUntil:"networkidle2"});
        await page.waitForSelector("#message-cart");
        await page.locator("#message-cart").fill("Oi, {{nome}}! Seu pedido favorito está esperando.");
        await click(page,"Salvar alterações");
        await page.waitForFunction(()=>document.body.textContent.includes("Automações salvas."));
        assert.equal(saved.cart.message,"Oi, {{nome}}! Seu pedido favorito está esperando.");
        assert.equal(saved.cart.enabled,false,"Editing a message must not enable sending");
        await screenshot(page,"automacoes-desktop");
        await page.setViewport({width:390,height:844});
        await screenshot(page,"automacoes-mobile");
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"Mobile automation page must not overflow horizontally");
        await page.goto(BASE+"/painel/clientes",{waitUntil:"networkidle2"});
        await page.waitForFunction(()=>document.body.textContent.includes("Cliente CRM"));
        await screenshot(page,"clientes-mobile");
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"Mobile customer page must not overflow horizontally");
        console.log("PASS CRM customer list/detail, automation customization/save, desktop/mobile (isolated API fixtures)");
    } finally {await context.close();}
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
        await crmPanels(browser);
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
