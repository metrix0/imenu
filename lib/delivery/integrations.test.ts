import { createHmac } from "node:crypto";
import { query, withTransaction } from "@/lib/database/sql";
import { dispatchCourier, importIfoodOrder } from "./integrations";
import { emptyDeliveryConfig, ifoodRequest, machinePayload, mapIfoodOrder, seal, unseal, validSignature } from "./providers";
import { POST as webhook } from "@/app/api/integrations/ifood/route";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withTransaction: jest.fn() }));
const sql = query as jest.Mock;
const config = () => ({ ...structuredClone(emptyDeliveryConfig), machine: {
    enabled:true,apiKey:"key",username:"company",password:"secret",companyId:"123",payment:"F",categoryId:"",
} });
const order = { id:"11111111-1111-4111-8111-111111111111",restaurant_id:"restaurant",is_delivery:"entrega",status:"preparing",display_id:7,
    customer_name:"Ana",customer_phone:"19999999999",customer_address:"Rua A, 10 - Centro - 13500-000 (Casa)",city:"Rio Claro",state:"SP" };
const ifoodOrder = { id:"22222222-2222-4222-8222-222222222222",displayId:"1234",orderType:"DELIVERY",merchant:{id:"merchant"},
    total:{itemsPrice:32,deliveryFee:5,orderAmount:37},customer:{name:"Ana"},
    items:[{name:"Lanche",quantity:2,totalPrice:32,observations:"Sem cebola",options:[{quantity:1,name:"Queijo"}]}],
    payments:{methods:[{method:"CREDIT",type:"ONLINE"}]},delivery:{deliveryAddress:{streetName:"Rua A",streetNumber:"10",neighborhood:"Centro",city:"Rio Claro",state:"SP"}} };
beforeEach(() => {
    jest.resetAllMocks();
    process.env.DELIVERY_INTEGRATIONS_KEY = Buffer.alloc(32,1).toString("base64");
    delete process.env.MACHINE_API_ENVIRONMENT;
    global.fetch = jest.fn();
});
test("credentials are encrypted, authenticated and require a valid key", () => {
    const value = seal(config());
    expect(value).not.toContain("secret");
    expect(unseal(value)).toEqual(config());
    process.env.DELIVERY_INTEGRATIONS_KEY = Buffer.alloc(32,2).toString("base64");
    expect(() => unseal(value)).toThrow();
    delete process.env.DELIVERY_INTEGRATIONS_KEY;
    expect(() => seal(config())).toThrow();
});
test("webhook signature uses original bytes, rejects invalid/tampered signatures", () => {
    const raw = '{ "a": 1 }';
    const signature = createHmac("sha256","secret").update(raw).digest("hex");
    expect(validSignature(raw,signature,"secret")).toBe(true);
    expect(validSignature('{"a":1}',signature,"secret")).toBe(false);
    expect(validSignature(raw,"wrong","secret")).toBe(false);
});
test("iFood mapping preserves totals/options/payment without product matching", () => {
    const mapped = mapIfoodOrder(ifoodOrder);
    expect(mapped).toMatchObject({subtotal:3200,delivery:500,total:3700,type:"entrega"});
    expect(mapped.items[0]).toMatchObject({name:"Lanche",quantity:2,price:1600,total:3200});
    expect(mapped.items[0].observation).toContain("1x Queijo");
    expect(mapped.items[0].observation).toContain("CREDIT (ONLINE)");
    expect(() => mapIfoodOrder({...ifoodOrder,total:{}})).toThrow();
});
test("Machine destination includes unique order reference and never guesses malformed addresses", () => {
    expect(machinePayload(order,config().machine)).toMatchObject({empresa_id:123,forma_pagamento:"F",paradas:[{id_externo:order.id,endereco_parada:"Rua A, 10",bairro_parada:"Centro",cidade_parada:"Rio Claro"}]});
    expect(() => machinePayload({...order,customer_address:"unstructured"},config().machine)).toThrow();
});
test.each(["retirada","mesa","balcao"])("%s never calls Machine",async type => {
    sql.mockResolvedValueOnce({rows:[{...order,is_delivery:type}]});
    expect(await dispatchCourier(order.id)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(sql).toHaveBeenCalledTimes(1);
});
test("imported iFood orders never request a second courier",async () => {
    sql.mockResolvedValueOnce({rows:[{...order,ifood_id:"external"}]});
    await dispatchCourier(order.id);
    expect(fetch).not.toHaveBeenCalled();
});
function setupDispatch(claim = 1) {
    sql.mockResolvedValueOnce({rows:[order]})
        .mockResolvedValueOnce({rows:[{credentials:seal(config())}]})
        .mockResolvedValueOnce({rowCount:claim,rows:[]}).mockResolvedValue({rowCount:1,rows:[]});
}
test("disabled integration never dispatches",async () => {
    sql.mockResolvedValueOnce({rows:[order]}).mockResolvedValueOnce({rows:[]});
    await dispatchCourier(order.id);
    expect(fetch).not.toHaveBeenCalled();
});
test("dispatch defaults to sandbox and records provider confirmation",async () => {
    setupDispatch();
    (fetch as jest.Mock).mockResolvedValue({ok:true,status:200,json:async()=>({success:true,data:{id_mch:"42"}})});
    expect(await dispatchCourier(order.id)).toBeNull();
    expect((fetch as jest.Mock).mock.calls[0][0]).toContain("api-vendas.taximachine.com.br");
    expect(sql.mock.calls.at(-1)?.[1]).toEqual([order.id,"42"]);
});
test("a claimed/uncertain request is never sent twice",async () => {
    setupDispatch(0);
    await dispatchCourier(order.id);
    expect(fetch).not.toHaveBeenCalled();
});
test("timeout retains an uncertain result instead of automatically retrying",async () => {
    setupDispatch();
    (fetch as jest.Mock).mockRejectedValue(new Error("Timeout"));
    expect(await dispatchCourier(order.id)).toContain("sem confirmação");
    expect(sql.mock.calls.at(-1)?.[1][1]).toBe("uncertain");
    expect(fetch).toHaveBeenCalledTimes(1);
});
test("HTTP 200 without id_mch is a failure, not success",async () => {
    setupDispatch();
    (fetch as jest.Mock).mockResolvedValue({ok:true,status:200,json:async()=>({success:true,data:{erros:["No driver"]}})});
    expect(await dispatchCourier(order.id)).toContain("recusou");
    expect(sql.mock.calls.at(-1)?.[1][1]).toBe("failed");
});
test("replayed iFood order does not create another order or print job",async () => {
    const client = {query:jest.fn().mockResolvedValue({rowCount:1,rows:[]})};
    (withTransaction as jest.Mock).mockImplementation(callback=>callback(client));
    await importIfoodOrder("restaurant",ifoodOrder);
    expect(client.query.mock.calls.some(([text])=>text.includes("INSERT"))).toBe(false);
});
test("new iFood order/items/mapping are inserted in one transaction",async () => {
    const client = {query:jest.fn().mockResolvedValue({rowCount:1,rows:[]})};
    client.query.mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rowCount:0,rows:[]}).mockResolvedValueOnce({rows:[{id:"local"}]});
    (withTransaction as jest.Mock).mockImplementation(callback=>callback(client));
    await importIfoodOrder("restaurant",ifoodOrder);
    expect(client.query.mock.calls.filter(([text])=>text.includes("INSERT"))).toHaveLength(3);
    expect(fetch).not.toHaveBeenCalled();
});
test("webhook rejects a forged request before fetching or importing",async () => {
    const c = config();c.ifood={enabled:true,merchantId:"merchant",clientId:"client",clientSecret:"secret"};
    sql.mockResolvedValue({rows:[{restaurant_id:"restaurant",credentials:seal(c)}]});
    const response = await webhook(new Request("https://local/api/integrations/ifood",{method:"POST",body:JSON.stringify({merchantId:"merchant",code:"PLC",orderId:ifoodOrder.id})}));
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
});

test("unrelated iFood events do not write to iFood or change local orders",async () => {
    const c = config();c.ifood={enabled:true,merchantId:"merchant",clientId:"client",clientSecret:"secret"};
    sql.mockResolvedValue({rows:[{restaurant_id:"restaurant",credentials:seal(c)}]});
    const raw = JSON.stringify({merchantId:"merchant",code:"ADR",fullCode:"ASSIGN_DRIVER",orderId:ifoodOrder.id});
    const signature = createHmac("sha256","secret").update(raw).digest("hex");
    const response = await webhook(new Request("https://local/api/integrations/ifood",{method:"POST",headers:{"x-ifood-signature":signature},body:raw}));
    expect(response.status).toBe(202);
    expect(fetch).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
});
test("sandbox and production dispatch use the same payload and explicit production opt-in",async () => {
    setupDispatch();
    process.env.MACHINE_API_ENVIRONMENT="production";
    (fetch as jest.Mock).mockResolvedValue({ok:true,status:200,json:async()=>({success:true,data:{id_mch:"42"}})});
    await dispatchCourier(order.id);
    expect((fetch as jest.Mock).mock.calls[0][0]).toBe("https://api.taximachine.com.br/api/v2/integracao/entregas");
});
test("duplicate provider reference leaves uncertain result, blocking automatic retries",async () => {
    setupDispatch();
    (fetch as jest.Mock).mockResolvedValue({ok:false,status:400,json:async()=>({success:false,errors:[{code:8,message:"duplicate"}]})});
    await dispatchCourier(order.id);
    expect(sql.mock.calls.at(-1)?.[1][1]).toBe("uncertain");
});

test("iFood commands accept an empty 202 response and dispatch the required merchant body",async()=>{
    (fetch as jest.Mock).mockResolvedValueOnce({ok:true,json:async()=>({accessToken:"token"})}).mockResolvedValueOnce({ok:true,status:202,json:jest.fn(()=>{throw new Error("empty body");})});
    await ifoodRequest({enabled:true,merchantId:"merchant",clientId:"client",clientSecret:"secret"},"/order/v1.0/orders/id/dispatch","dispatch");
    expect((fetch as jest.Mock).mock.calls[1][1]).toMatchObject({method:"POST",body:JSON.stringify({deliveredBy:"MERCHANT"})});
});
test("iFood command rejection is propagated without treating HTTP response as confirmation",async()=>{
    (fetch as jest.Mock).mockResolvedValueOnce({ok:true,json:async()=>({accessToken:"token"})}).mockResolvedValueOnce({ok:false,status:409});
    await expect(ifoodRequest({enabled:true,merchantId:"merchant",clientId:"client",clientSecret:"secret"},"/order/v1.0/orders/id/confirm","confirm")).rejects.toThrow("status anterior foi mantido");
});
