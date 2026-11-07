import { query } from "@/lib/database/sql";
import { integrationForUrl, installIntegrationObserver, recordDevAlert } from "../health";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn().mockResolvedValue({ rows: [{id:"unit-alert"}], rowCount: 1 }) }));
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; delete (globalThis as typeof globalThis & { __imenuDevObserver?: boolean }).__imenuDevObserver; });

test("provider matching uses exact host boundaries and configured internal WAHA host", () => {
    expect(integrationForUrl("https://api.asaas.com/v3/transfers?secret=abc")).toBe("asaas");
    expect(integrationForUrl("https://asaas.com.evil.example/anything")).toBeNull();
    process.env.WAHA_API_URL = "http://waha:3000";
    expect(integrationForUrl("http://waha:3000/api/sessions")).toBe("waha");
    delete process.env.WAHA_API_URL;
});

test("real HTTP failures record only provider/status, preserving the original response", async () => {
    const response = new Response("private provider response", { status: 503 });
    global.fetch = jest.fn().mockResolvedValue(response);
    installIntegrationObserver();
    expect(await fetch("https://api.tomtom.com/search?key=do-not-store&address=private")).toBe(response);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO public.dev_alerts"), expect.arrayContaining(["tomtom", "HTTP 503"]));
    expect(JSON.stringify((query as jest.Mock).mock.calls)).not.toContain("do-not-store");
    expect(JSON.stringify((query as jest.Mock).mock.calls)).not.toContain("private provider response");
});

test("ordinary validation/not-found responses do not create outage alerts", async () => {
    (query as jest.Mock).mockClear();
    global.fetch = jest.fn().mockResolvedValue(new Response("", { status: 404 })); installIntegrationObserver();
    await fetch("https://api.openai.com/v1/files/missing");
    expect(query).not.toHaveBeenCalled();
});

test("monitoring storage failures never replace the underlying request result", async () => {
    (query as jest.Mock).mockRejectedValueOnce(new Error("database unavailable"));
    await expect(recordDevAlert({ source: "unit-test", title: "Failure", message: "Unavailable" })).resolves.toEqual(expect.any(Object));
});

test("successful provider observations persist across workers and overwrite a failed state", async()=>{
 const {observeIntegration}=await import("../health");
 (query as jest.Mock).mockClear();
 observeIntegration("recovery-test",false,503);observeIntegration("recovery-test",true,200);
 expect(query).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT(source) DO UPDATE"),["recovery-test",true,200]);
});

test.each([['info',false,false],['warning',true,false],['critical',true,true]])("central severity routing for %s",async(severity,notified,alarm)=>{
 const previous=process.env.NTFY_TOPIC;process.env.NTFY_TOPIC="unit-test-topic";
 global.fetch=jest.fn().mockResolvedValue(new Response("",{status:200}));
 try{
 await recordDevAlert({source:"severity-"+severity,title:"Unit alert",message:"Unit message",severity});
 expect(global.fetch).toHaveBeenCalledTimes(notified?1:0);
 expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO public.dev_alerts"),expect.arrayContaining(["severity-"+severity]));
 expect(query).toHaveBeenCalledWith(expect.stringContaining("UPDATE public.dev_alerts"),["unit-alert",notified,alarm,null]);
 if(alarm)expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Title).toContain("TRIGGER ALARM");
 }finally{if(previous===undefined)delete process.env.NTFY_TOPIC;else process.env.NTFY_TOPIC=previous;}
});

test("failed delivery keeps the triggering source and never reports a delivered alarm",async()=>{
 const previous=process.env.NTFY_TOPIC;process.env.NTFY_TOPIC="unit-test-topic";
 global.fetch=jest.fn().mockResolvedValue(new Response("",{status:503}));
 try{
 await recordDevAlert({source:"cron/test",title:"TRIGGER ALARM test",message:"test",notification:true});
 expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO public.dev_alerts"),expect.arrayContaining(["cron/test"]));
 expect(query).toHaveBeenCalledWith(expect.stringContaining("UPDATE public.dev_alerts"),["unit-alert",false,false,"ntfy HTTP 503"]);
 }finally{if(previous===undefined)delete process.env.NTFY_TOPIC;else process.env.NTFY_TOPIC=previous;}
});

 test("a duplicate claimed by another worker does not send a second notification",async()=>{
 (query as jest.Mock).mockResolvedValueOnce({rows:[],rowCount:0});global.fetch=jest.fn();
 await recordDevAlert({source:"duplicate-worker",title:"Duplicate",message:"Same",severity:"critical"});
 expect(global.fetch).not.toHaveBeenCalled();
 });
