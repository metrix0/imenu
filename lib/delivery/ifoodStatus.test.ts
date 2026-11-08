import { query, withTransaction } from "@/lib/database/sql";
import { ifoodRequest } from "./providers";
import { loadDeliveryConfig } from "./integrations";
import { requestIfoodStatus, receiveIfoodStatus } from "./ifoodStatus";
jest.mock("@/lib/database/sql",()=>({query:jest.fn(),withTransaction:jest.fn()}));
jest.mock("./providers",()=>({ifoodRequest:jest.fn()}));
jest.mock("./integrations",()=>({loadDeliveryConfig:jest.fn()}));
const imported={external_id:"external",restaurant_id:"restaurant",order_id:"local",sync_state:{}};
const details={id:"external",merchant:{id:"merchant"},orderType:"DELIVERY",orderTiming:"IMMEDIATE",delivery:{deliveredBy:"MERCHANT"}};
const config={ifood:{enabled:true,clientId:"id",clientSecret:"secret",merchantId:"merchant"}};
beforeEach(()=>{jest.resetAllMocks();(query as jest.Mock).mockResolvedValue({rows:[imported]});(loadDeliveryConfig as jest.Mock).mockResolvedValue(config);(ifoodRequest as jest.Mock).mockResolvedValue(details);});
test("accept sends confirm and never updates local status before a confirmed event",async()=>{
 await requestIfoodStatus("local","pending_physical_payment","preparing");
 expect(ifoodRequest).toHaveBeenLastCalledWith(config.ifood,"/order/v1.0/orders/external/confirm","confirm");
 expect((query as jest.Mock).mock.calls.every(([sql])=>!sql.includes("UPDATE orders"))).toBe(true);
});
test("API rejection does not persist a command or advance the local status",async()=>{
 (ifoodRequest as jest.Mock).mockResolvedValueOnce(details).mockRejectedValueOnce(new Error("iFood rejected"));
 await expect(requestIfoodStatus("local","pending_physical_payment","preparing")).rejects.toThrow("iFood rejected");
 expect(query).toHaveBeenCalledTimes(1);
});
test("ready sends readiness before dispatch; merchant dispatch resumes after readiness confirmation",async()=>{
 await requestIfoodStatus("local","preparing","delivering");
 expect(ifoodRequest).toHaveBeenLastCalledWith(config.ifood,"/order/v1.0/orders/external/readyToPickup","readyToPickup");
 (query as jest.Mock).mockResolvedValue({rows:[{...imported,sync_state:{ready:true,deliveredBy:"MERCHANT"}}]});
 await requestIfoodStatus("local","preparing","delivering");
 expect(ifoodRequest).toHaveBeenLastCalledWith(config.ifood,"/order/v1.0/orders/external/dispatch","dispatch");
});
test.each(["canceled","done","paid"])("unsupported transition to %s sends no provider commands",async target=>{
 await expect(requestIfoodStatus("local","preparing",target)).rejects.toThrow();expect(ifoodRequest).not.toHaveBeenCalled();
});
test("duplicate click awaiting confirmation sends no second command",async()=>{
 (query as jest.Mock).mockResolvedValue({rows:[{...imported,sync_state:{pendingAction:"confirm",sentAt:Date.now()}}]});
 await requestIfoodStatus("local","pending_physical_payment","preparing");expect(ifoodRequest).not.toHaveBeenCalled();
});
function eventSetup(state:any={},status="preparing"){
 const client={query:jest.fn().mockResolvedValue({rows:[]})};
 client.query.mockResolvedValueOnce({rows:[{id:"local",status}]}).mockResolvedValueOnce({rows:[{...imported,sync_state:state}]});
 (withTransaction as jest.Mock).mockImplementation(fn=>fn(client));return client;
}
const event=(name:string)=>({orderId:"external",fullCode:name,createdAt:"2026-11-08T12:00:00Z"});
test("merchant readiness triggers dispatch but does not claim dispatch was confirmed",async()=>{
 const client=eventSetup({requestedStatus:"delivering"});await receiveIfoodStatus("restaurant",event("READY_TO_PICKUP"));
 expect(ifoodRequest).toHaveBeenLastCalledWith(config.ifood,"/order/v1.0/orders/external/dispatch","dispatch");
 expect(client.query.mock.calls.some(([sql])=>sql.includes("UPDATE orders"))).toBe(false);
});
test("iFood logistics readiness never dispatches a merchant driver",async()=>{
 const client=eventSetup({requestedStatus:"delivering"});(ifoodRequest as jest.Mock).mockResolvedValue({...details,delivery:{deliveredBy:"IFOOD"}});
 await receiveIfoodStatus("restaurant",event("READY_TO_PICKUP"));
 expect(ifoodRequest).toHaveBeenCalledTimes(1);expect(client.query.mock.calls.some(([sql])=>sql.includes("UPDATE orders"))).toBe(false);
});
test("takeout readiness maps to local ready; pickup never dispatches",async()=>{
 const client=eventSetup();(ifoodRequest as jest.Mock).mockResolvedValue({...details,orderType:"TAKEOUT"});
 await receiveIfoodStatus("restaurant",event("READY_TO_PICKUP"));
 expect(client.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE orders"),["local","delivering"]);expect(ifoodRequest).toHaveBeenCalledTimes(1);
});
test.each([["DISPATCHED","delivering"],["CONCLUDED","done"],["CONFIRMED","preparing"]])("confirmed %s advances only from its authenticated event",async(name,target)=>{
 const client=eventSetup({},"pending_physical_payment");await receiveIfoodStatus("restaurant",event(name));
 expect(client.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE orders"),["local",target]);
});
test("stale events and duplicate events never regress statuses or resend commands",async()=>{
 eventSetup({eventRank:4,eventAt:"2026-11-08T13:00:00Z"});await receiveIfoodStatus("restaurant",event("CONFIRMED"));expect(ifoodRequest).not.toHaveBeenCalled();
 eventSetup({eventRank:3,eventAt:event("READY_TO_PICKUP").createdAt,requestedStatus:"delivering"});await receiveIfoodStatus("restaurant",event("READY_TO_PICKUP"));expect(ifoodRequest).not.toHaveBeenCalled();
});
test("scheduled acceptance does not start preparation early",async()=>{
 eventSetup({pendingAction:"confirm"},"pending_physical_payment");(ifoodRequest as jest.Mock).mockResolvedValue({...details,orderTiming:"SCHEDULED"});
 await receiveIfoodStatus("restaurant",event("CONFIRMED"));expect(ifoodRequest).toHaveBeenCalledTimes(1);
});
