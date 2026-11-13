import { GET, PATCH } from "./route";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { query, withTransaction } from "@/lib/database/sql";
import { emptyDeliveryConfig, seal, unseal } from "@/lib/delivery/providers";

jest.mock("@/lib/database/sql", () => ({ query:jest.fn(),withTransaction:jest.fn() }));
jest.mock("@/lib/auth/restaurantOwner",()=>({
    requireRestaurantOwner:jest.fn(),
    RestaurantOwnerAuthError:class extends Error { status:number; constructor(message:string,status:number){ super(message);this.status=status; } },
}));
beforeEach(()=>{
    jest.resetAllMocks();
    process.env.DELIVERY_INTEGRATIONS_KEY=Buffer.alloc(32,1).toString("base64");
    (requireRestaurantOwner as jest.Mock).mockResolvedValue({});
});
test.each([GET,PATCH])("rejects other owners before reading or writing configuration",async handler=>{
    (requireRestaurantOwner as jest.Mock).mockRejectedValue(new RestaurantOwnerAuthError("Acesso negado.",403));
    const response=await handler(new Request("https://local/api/integrations/delivery?restaurantId=other",{method:"POST",body:JSON.stringify({restaurantId:"other"})}));
    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
});
test("GET returns no passwords/API secrets",async()=>{
    const config=structuredClone(emptyDeliveryConfig);
    config.ifood.clientSecret="ifood-secret";config.machine.apiKey="machine-key";config.machine.password="password-secret";
    (query as jest.Mock).mockResolvedValueOnce({rows:[{credentials:seal(config)}]}).mockResolvedValueOnce({rows:[]});
    const response=await GET(new Request("https://local/api/integrations/delivery?restaurantId=restaurant"));
    const payload=await response.json();
    expect(payload.config.ifood.clientSecret).toBe("");
    expect(payload.config.machine.apiKey).toBe("");
    expect(payload.config.machine.password).toBe("");
    expect(payload.configured).toEqual({ifood:false,machine:true});
});
test("autosave retains masked Machine credentials and cannot replace server-owned iFood fields",async()=>{
    const old=structuredClone(emptyDeliveryConfig);
    old.ifood.clientSecret="ifood-secret";old.machine.password="machine-secret";old.machine.apiKey="key";
    const client={query:jest.fn().mockResolvedValue({rows:[]})};
    client.query.mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{credentials:seal(old)}]});
    (withTransaction as jest.Mock).mockImplementation(callback=>callback(client));
    const next=structuredClone(emptyDeliveryConfig);next.ifood.clientId="new-client";next.machine.username="new-user";
    const response=await PATCH(new Request("https://local/api/integrations/delivery",{method:"PATCH",body:JSON.stringify({restaurantId:"restaurant",config:next})}));
    expect(response.status).toBe(200);
    const stored=unseal(client.query.mock.calls.at(-1)?.[1][1]);
    expect(stored.ifood).toMatchObject({clientSecret:"ifood-secret",clientId:""});
    expect(stored.machine).toMatchObject({password:"machine-secret",apiKey:"key",username:"new-user"});
});

test.each([false,true])("Machine settings remain independent of the iFood authorization flow (enabled=%s)",async enabled=>{
    const client={query:jest.fn().mockResolvedValue({rows:[]})};
    (withTransaction as jest.Mock).mockImplementation(callback=>callback(client));
    const config=structuredClone(emptyDeliveryConfig);
    config.machine.enabled=enabled;
    config.ifood.merchantId="unfinished";
    global.fetch=jest.fn().mockRejectedValue(new Error("Provider offline"));
    const response=await PATCH(new Request("https://local/api/integrations/delivery",{method:"PATCH",body:JSON.stringify({restaurantId:"restaurant",config})}));
    expect(response.status).toBe(200);
    const params=client.query.mock.calls.at(-1)?.[1];
    const saved=unseal(params[1]);
    expect(saved.ifood).toMatchObject({enabled:false,merchantId:"",clientId:"",clientSecret:""});
    expect(saved.machine.enabled).toBe(enabled);
    expect(params[2]).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
});
test("an unconnected iFood integration cannot be activated by a toggle",async()=>{
    const client={query:jest.fn().mockResolvedValue({rows:[]})};
    (withTransaction as jest.Mock).mockImplementation(callback=>callback(client));
    const response=await PATCH(new Request("https://local/api/integrations/delivery",{method:"PATCH",body:JSON.stringify({restaurantId:"restaurant",config:{ifood:{enabled:true}}})}));
    expect(response.status).toBe(409);
    expect(client.query.mock.calls.some(([sql])=>sql.includes("INSERT"))).toBe(false);
});
test("GET hides OAuth tokens, verifier and application credentials",async()=>{
    const config=structuredClone(emptyDeliveryConfig);
    config.ifood.connection={restaurantId:"restaurant",accessToken:"access-private",refreshToken:"refresh-private",expiresAt:Date.now()+60000,
        pending:{userCode:"PUBLIC",url:"https://portal.ifood.com.br/apps/code?c=PUBLIC",verifier:"verifier-private",expiresAt:Date.now()+60000}};
    (query as jest.Mock).mockResolvedValueOnce({rows:[{credentials:seal(config)}]}).mockResolvedValueOnce({rows:[]});
    const response=await GET(new Request("https://local/api/integrations/delivery?restaurantId=restaurant"));
    const text=await response.text();
    expect(text).toContain("PUBLIC");
    for(const secret of ["access-private","refresh-private","verifier-private"]) expect(text).not.toContain(secret);
});
test("Machine autosave preserves new OAuth tokens and selected merchant",async()=>{
    const old=structuredClone(emptyDeliveryConfig);
    old.ifood={enabled:true,merchantId:"11111111-1111-4111-8111-111111111111",clientId:"",clientSecret:"",
        connection:{restaurantId:"restaurant",refreshToken:"new-token"}};
    const client={query:jest.fn().mockResolvedValue({rows:[]})};
    client.query.mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{credentials:seal(old)}]});
    (withTransaction as jest.Mock).mockImplementation(callback=>callback(client));
    const response=await PATCH(new Request("https://local/api/integrations/delivery",{method:"PATCH",body:JSON.stringify({restaurantId:"restaurant",config:{machine:emptyDeliveryConfig.machine}})}));
    expect(response.status).toBe(200);
    expect(unseal(client.query.mock.calls.at(-1)?.[1][1]).ifood).toEqual(old.ifood);
});

