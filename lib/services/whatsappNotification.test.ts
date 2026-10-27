import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { query } from "@/lib/database/sql";
import { getWahaPhoneLid, sendWahaOrderOptions, sendWahaText } from "@/lib/services/wahaClient";
import { getRestaurantTemplateData, getWhatsAppTemplates, buildRestaurantTemplateVariables, renderWhatsAppTemplate } from "@/lib/services/whatsappMessageTemplates";
import { sendOrderNotification, notifyOrderStatusUpdate, handleOrderNotificationReply, normalizeNotificationPhone } from "./whatsappNotification";
jest.mock("@/lib/addons/access",()=>({hasIMenuPlusAccess:jest.fn()}));
jest.mock("@/lib/database/sql",()=>({query:jest.fn()}));
jest.mock("@/lib/services/wahaClient",()=>({getWahaPhoneLid:jest.fn(),sendWahaOrderOptions:jest.fn(),sendWahaText:jest.fn()}));
jest.mock("@/lib/services/whatsappMessageTemplates",()=>({getRestaurantTemplateData:jest.fn(),getWhatsAppTemplates:jest.fn(),buildRestaurantTemplateVariables:jest.fn(),renderWhatsAppTemplate:jest.fn()}));
const id="12345678-1234-1234-1234-123456789abc";
let order:any, recent:boolean, claims:Set<string>, sentRow:any;
beforeEach(()=>{
    jest.clearAllMocks(); recent=true;claims=new Set();sentRow=null;
    order={id,restaurant_id:"restaurant",display_id:12,customer_phone:"19999999999",customer_name:"Ana",is_delivery:"entrega",
        status:"delivering",total_cents:4000,session_name:"session",connection_status:"WORKING",desired_state:"connected",
        addon_status:"active",current_period_ends_at:null,enabled:true};
    (hasIMenuPlusAccess as jest.Mock).mockImplementation(async()=>order.addon_status==="active");
    (getWahaPhoneLid as jest.Mock).mockResolvedValue("123@lid");
    (getRestaurantTemplateData as jest.Mock).mockResolvedValue({name:"Loja"});
    (getWhatsAppTemplates as jest.Mock).mockResolvedValue({status_notification:"template"});
    (buildRestaurantTemplateVariables as jest.Mock).mockImplementation((_,extra)=>extra);
    (renderWhatsAppTemplate as jest.Mock).mockImplementation((_,vars)=>vars.STATUS_DO_PEDIDO);
    (sendWahaOrderOptions as jest.Mock).mockResolvedValue({id:"provider"});
    (sendWahaText as jest.Mock).mockResolvedValue({id:"reply"});
    (query as jest.Mock).mockImplementation(async(sql:string,params:any[])=>{
        if(sql.includes("FROM orders o"))return {rows:[order]};
        if(sql.includes("FROM whatsapp_conversations"))return {rows:recent?[{chat_id:"123@lid"}]:[]};
        if(sql.includes("SELECT status FROM whatsapp_outbound"))return {rows:[]};
        if(sql.includes("FROM order_items"))return {rows:[{name:"Pizza",quantity:2}]};
        if(sql.includes("JOIN orders o"))return {rows:sentRow?[sentRow]:[]};
        if(sql.includes("INSERT INTO whatsapp_outbound")){
            if(claims.has(params[0]))return {rows:[],rowCount:0};
            claims.add(params[0]);return {rows:[{}],rowCount:1};
        }
        return {rows:[],rowCount:1};
    });
});
test("normalizes local and international Brazilian phones",()=>{
    expect(normalizeNotificationPhone("(19) 99999-9999")).toBe("5519999999999");
    expect(normalizeNotificationPhone("invalid")).toBeNull();
});
test.each(["preparing","done","canceled"])("does not automatically notify status %s",async(status)=>{
    await notifyOrderStatusUpdate(id,status);expect(query).not.toHaveBeenCalled();
});
test("requires Plus on the server",async()=>{
    order.addon_status="pending";await expect(sendOrderNotification(id,"ready")).rejects.toMatchObject({status:402});
    expect(sendWahaOrderOptions).not.toHaveBeenCalled();
});
test.each(["no interaction","toggle disabled"])("skips automatic send: %s",async(condition)=>{
    if(condition==="no interaction")recent=false;else order.enabled=false;
    expect(await sendOrderNotification(id,"ready")).toEqual({skipped:true});
    expect(sendWahaOrderOptions).not.toHaveBeenCalled();
});
test("requires confirmation for manual notification outside seven days",async()=>{
    recent=false;expect(await sendOrderNotification(id,"arrival")).toEqual({confirmationRequired:true});
    expect(sendWahaOrderOptions).not.toHaveBeenCalled();
    expect(await sendOrderNotification(id,"arrival",true)).toMatchObject({sent:true});
});
test("automatically sends manual notification with recent interaction",async()=>{
    expect(await sendOrderNotification(id,"arrival")).toMatchObject({sent:true});
});
test("claims only once for concurrent requests and repeated status transitions",async()=>{
    await Promise.all([sendOrderNotification(id,"ready"),sendOrderNotification(id,"ready")]);
    await notifyOrderStatusUpdate(id,"preparing");await notifyOrderStatusUpdate(id,"delivering");
    expect(sendWahaOrderOptions).toHaveBeenCalledTimes(1);
});
test("arrival has a separate dedupe key and includes order details",async()=>{
    await sendOrderNotification(id,"ready");await sendOrderNotification(id,"arrival");
    expect(sendWahaOrderOptions).toHaveBeenCalledTimes(2);
    expect((sendWahaOrderOptions as jest.Mock).mock.calls[1][2]).toContain("2x Pizza");
    expect((sendWahaOrderOptions as jest.Mock).mock.calls[1][3][0].title).toBe("Já peguei o pedido");
});
test("balcao gets the pickup response",async()=>{
    order.is_delivery="balcao";await sendOrderNotification(id,"ready");
    expect((sendWahaOrderOptions as jest.Mock).mock.calls[0][3][0].title).toBe("Estou indo buscar");
});
test("uncertain provider failure is not retried",async()=>{
    (sendWahaOrderOptions as jest.Mock).mockRejectedValueOnce(new Error("timeout"));
    await expect(sendOrderNotification(id,"ready")).rejects.toMatchObject({status:502});
    await sendOrderNotification(id,"ready");expect(sendWahaOrderOptions).toHaveBeenCalledTimes(1);
});
test("rejects another customer and deduplicates valid acknowledgements",async()=>{
    sentRow={chat_id:"123@lid",customer_phone:order.customer_phone,is_delivery:"entrega"};
    const reply="order_reply:"+id+":ready:thanks";
    await handleOrderNotificationReply("restaurant","session","other@lid",reply,"5511888888888");
    expect(sendWahaText).not.toHaveBeenCalled();
    await handleOrderNotificationReply("restaurant","session","123@lid",reply,order.customer_phone);
    await handleOrderNotificationReply("restaurant","session","123@lid",reply,order.customer_phone);
    expect(sendWahaText).toHaveBeenCalledTimes(1);
});
