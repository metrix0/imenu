import { query } from "@/lib/database/sql";
import { recordDevAlert, recordIntegrationProbe, resolveDevIncident } from "../health";

jest.mock("@/lib/database/sql", () => ({
    query: jest.fn().mockResolvedValue({rows:[{id:"unit-alert"}],rowCount:1}),
}));

const mockQuery = query as jest.Mock;
const originalFetch = global.fetch;
const originalTopic = process.env.NTFY_TOPIC;
beforeEach(() => {
    mockQuery.mockReset().mockResolvedValue({rows:[{id:"unit-alert"}],rowCount:1});
    process.env.NTFY_TOPIC = "test-notifications";
    global.fetch = jest.fn().mockResolvedValue(new Response("",{status:200}));
});
afterEach(() => {
    global.fetch = originalFetch;
    if(originalTopic===undefined) delete process.env.NTFY_TOPIC;
    else process.env.NTFY_TOPIC = originalTopic;
});

test("notification records its trigger and sends a normal phone notification",async()=>{
    await recordDevAlert({source:"test",title:"Warning",message:"safe",severity:"warning"});
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO public.dev_alerts"),
        expect.arrayContaining(["test","notification"]));
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Priority).toBe("4");
});

test("genuine critical alerts use Alarm priority and record actual delivery",async()=>{
    await recordDevAlert({source:"critical",title:"Failed",message:"safe",severity:"critical"});
    expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Title).toContain("TRIGGER ALARM");
    expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Priority).toBe("5");
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("UPDATE public.dev_alerts SET phone_notified"),
        ["unit-alert",true,true,null]);
});

test("Blast is classification only, never sends a mass message or a phone notification",async()=>{
    await recordDevAlert({source:"payouts",title:"PIX warning sent",message:"safe",trigger:"blast",severity:"info"});
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO public.dev_alerts"),
        expect.arrayContaining(["blast"]));
});

test("repeated incident increments occurrence without sending another notification",async()=>{
    mockQuery.mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[],rowCount:1});
    const value=await recordDevAlert({source:"health",title:"Bad",message:"HTTP 503",incidentKey:"integration:waha",severity:"warning"});
    expect(value).toEqual({phoneNotified:false,deliveryError:null});
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("occurrences=occurrences+1"),
        ["integration:waha","HTTP 503",null]);
    expect(global.fetch).not.toHaveBeenCalled();
});

test("first failed probe becomes degraded and never sends a notification",async()=>{
    mockQuery.mockResolvedValueOnce({rows:[]});
    const result=await recordIntegrationProbe({id:"waha",state:"failed",operation:"Listar sessões",status:500,detail:"HTTP 500"});
    expect(result.state).toBe("degraded");
    expect(global.fetch).not.toHaveBeenCalled();
});

test("second failed probe opens a deduplicated incident, recovery closes it",async()=>{
    mockQuery.mockResolvedValueOnce({rows:[{state:"degraded",check_kind:"probe"}]});
    await recordIntegrationProbe({id:"waha",state:"failed",operation:"Listar sessões",status:500,detail:"HTTP 500"});
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO public.dev_alerts"),
        expect.arrayContaining(["integration:waha"]));
    await resolveDevIncident("integration:waha");
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("resolved_at=NOW()"),["integration:waha"]);
});

test("monitoring storage failure does not throw into business operations",async()=>{
    mockQuery.mockRejectedValueOnce(new Error("Database unavailable"));
    await expect(recordDevAlert({source:"app",title:"Failed",message:"safe"})).resolves.toMatchObject({phoneNotified:true});
});
