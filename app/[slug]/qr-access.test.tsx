import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import MenuPage from "./page";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
jest.mock("@/lib/addons/access",()=>({hasIMenuPlusAccess:jest.fn()}));
jest.mock("next/navigation",()=>({notFound:()=>{throw new Error("NOT_FOUND")}}));
jest.mock("next/image",()=>({__esModule:true,default:({fill,...props}:any)=><img {...props}/>}));
jest.mock("./menu-client",()=>({__esModule:true,default:({tableOrder}:any)=><div data-table-mode={tableOrder.requiresTableSelection?"universal":"individual"} data-table-id={tableOrder.tableId}/>}));
jest.mock("./StartingPriceLabels",()=>({__esModule:true,default:({children}:any)=><>{children}</>}));
jest.mock("./PickupAvailabilityGuard",()=>({__esModule:true,default:()=>null}));
jest.mock("@/components/costumer/TrackingScripts",()=>({__esModule:true,default:()=>null}));
let mockDarkThemeEnabled=false;
jest.mock("./restaurant-data",()=>({getPublicMenuRestaurant:async()=>({id:"restaurant",name:"Test",availability_json:{},delivery_fee_json:{},latitude:0,longitude:0,dark_menu_enabled:mockDarkThemeEnabled})}));
let mockSettings:any[],mockLegacy:any[],mockTables:any[];
jest.mock("@/lib/database/supabaseServerClient",()=>({createSupabaseServerClient:()=>({
 from:(table:string)=>{
  let single=false;const filters:Array<[string,unknown]>=[];
  const result=()=>{let rows=table==="restaurant_qr_settings"?mockSettings:table==="restaurant_addons"?mockLegacy:table==="restaurant_tables"?mockTables:[];
   rows=rows.filter(row=>filters.every(([key,value])=>row[key]===value));
   return {data:single?(rows[0]||null):rows,error:null};
  };
  const chain:any=new Proxy({}, {get:(_,key)=>key==="then"?(resolve:any)=>resolve(result()):(...args:any[])=>{
   if(key==="eq")filters.push([args[0],args[1]]);
   if(key==="single"||key==="maybeSingle")single=true;
   return chain;
  }});return chain;
 },
 storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:""}})})},
})}));
const universal="10000000-0000-4000-8000-000000000001", tableToken="20000000-0000-4000-8000-000000000001";
beforeEach(()=>{mockDarkThemeEnabled=false;(hasIMenuPlusAccess as jest.Mock).mockReset().mockResolvedValue(false);mockSettings=[];mockLegacy=[];mockTables=[{id:"table",restaurant_id:"restaurant",name:"Mesa 1",public_token:tableToken,is_active:true}];});
async function render(mesa:string){return renderToStaticMarkup(await MenuPage({params:Promise.resolve({slug:"test"}),searchParams:Promise.resolve({origem:"mesa",mesa})}));}
test("free universal QR works without any add-on",async()=>{
 mockSettings=[{restaurant_id:"restaurant",universal_token:universal}];
 expect(await render(universal)).toContain('data-table-mode="universal"');
});
test("printed Plus universal QR survives expiry without a QR add-on",async()=>{
 mockLegacy=[{restaurant_id:"restaurant",product_key:"ia_plus",status:"canceled",current_period_ends_at:"2020-01-01T00:00:00Z",universal_token:universal}];
 expect(await render(universal)).toContain('data-table-mode="universal"');
});
test("per-table QR works without any subscription or free settings row",async()=>{
 expect(await render(tableToken)).toContain('data-table-mode="individual"');
});
test("unknown tokens and inactive tables remain blocked",async()=>{
 await expect(render(universal)).rejects.toThrow("NOT_FOUND");
 mockTables[0].is_active=false;
 await expect(render(tableToken)).rejects.toThrow("NOT_FOUND");
});

test("dark theme is shared by delivery and table menus only with active Plus",async()=>{
 mockDarkThemeEnabled=true;
 mockSettings=[{restaurant_id:"restaurant",universal_token:universal}];
 expect(await render(universal)).not.toContain('data-imenu-menu-theme="dark"');
 expect(hasIMenuPlusAccess).toHaveBeenCalledWith("restaurant");
 (hasIMenuPlusAccess as jest.Mock).mockResolvedValue(true);
 expect(await render(universal)).toContain('data-imenu-menu-theme="dark"');
 expect(renderToStaticMarkup(await MenuPage({params:Promise.resolve({slug:"test"}),searchParams:Promise.resolve({})}))).toContain('data-imenu-menu-theme="dark"');
});
