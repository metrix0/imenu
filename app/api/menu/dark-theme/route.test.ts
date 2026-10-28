import { PATCH } from "./route";
import { requireRestaurantOwner } from "@/lib/auth/restaurantOwner";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { query } from "@/lib/database/sql";

jest.mock("@/lib/auth/restaurantOwner",()=>({
 requireRestaurantOwner:jest.fn(),
 RestaurantOwnerAuthError:class extends Error { status=403; },
}));
jest.mock("@/lib/addons/access",()=>({hasIMenuPlusAccess:jest.fn()}));
jest.mock("@/lib/database/sql",()=>({query:jest.fn()}));

const restaurantId="12345678-1234-4234-8234-123456789abc";
const request=(enabled:boolean)=>new Request("http://test/api/menu/dark-theme",{
 method:"PATCH",headers:{Authorization:"Bearer test"},
 body:JSON.stringify({restaurantId,enabled}),
});

beforeEach(()=>{
 jest.clearAllMocks();
 (requireRestaurantOwner as jest.Mock).mockResolvedValue({restaurant:{id:restaurantId}});
 (hasIMenuPlusAccess as jest.Mock).mockResolvedValue(false);
 (query as jest.Mock).mockResolvedValue({rows:[{dark_menu_enabled:true}]});
});

test("requires valid Plus before enabling dark menu",async()=>{
 expect((await PATCH(request(true))).status).toBe(403);
 expect(query).not.toHaveBeenCalled();
});

test("a valid Plus owner can save dark menu",async()=>{
 (hasIMenuPlusAccess as jest.Mock).mockResolvedValue(true);
 const response=await PATCH(request(true));
 expect(response.status).toBe(200);
 expect(await response.json()).toEqual({enabled:true});
 expect(query).toHaveBeenCalledWith(expect.stringContaining("dark_menu_enabled"),[restaurantId,true]);
});

test("disabling remains possible after Plus expires",async()=>{
 (query as jest.Mock).mockResolvedValue({rows:[{dark_menu_enabled:false}]});
 const response=await PATCH(request(false));
 expect(response.status).toBe(200);
 expect(await response.json()).toEqual({enabled:false});
 expect(hasIMenuPlusAccess).not.toHaveBeenCalled();
});

test("owner check blocks writes before querying entitlement",async()=>{
 (requireRestaurantOwner as jest.Mock).mockRejectedValue(new Error("Denied"));
 expect((await PATCH(request(true))).status).toBe(500);
 expect(hasIMenuPlusAccess).not.toHaveBeenCalled();
 expect(query).not.toHaveBeenCalled();
});
