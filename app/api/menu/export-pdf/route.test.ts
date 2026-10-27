import { GET } from "./route";
import { query } from "@/lib/database/sql";
import { buildPrintableMenuPdf } from "@/lib/menu/printPdf";
jest.mock("@/lib/auth/restaurantOwner",()=>({requireRestaurantOwner:jest.fn(async()=>({restaurant:{name:"Test",url_slug:"test"}})),RestaurantOwnerAuthError:class extends Error{status=403}}));
jest.mock("@/lib/database/sql",()=>({query:jest.fn()}));
jest.mock("@/lib/menu/printPdf",()=>({buildPrintableMenuPdf:jest.fn(()=>new Uint8Array([37,80,68,70]))}));
const request=()=>new Request("http://test/api/menu/export-pdf?restaurantId=12345678-1234-4234-8234-123456789abc");
beforeEach(()=>jest.clearAllMocks());
test.each([null,{status:"pending",current_period_ends_at:null},{status:"canceled",current_period_ends_at:"2020-01-01T00:00:00Z"}])("PDF rejects missing or expired Plus even with free QR: %j",async(plus)=>{
 (query as jest.Mock).mockImplementation(async(sql:string)=>({rows:sql.includes("product_key='ia_plus'")?(plus?[plus]:[]):[{status:"active",current_period_ends_at:null}]}));
 expect((await GET(request())).status).toBe(403);
 expect(buildPrintableMenuPdf).not.toHaveBeenCalled();
});
test.each(["active","canceled","past_due"])("PDF accepts paid Plus access: %s",async(status)=>{
 (query as jest.Mock).mockImplementation(async(sql:string)=>({rows:sql.includes("product_key='ia_plus'")?[{status,current_period_ends_at:new Date(Date.now()+86400000).toISOString()}]:[]}));
 expect((await GET(request())).status).toBe(200);
 expect(buildPrintableMenuPdf).toHaveBeenCalledTimes(1);
});
