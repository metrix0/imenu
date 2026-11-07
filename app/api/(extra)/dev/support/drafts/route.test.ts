import { GET, POST } from "./route";
import { authorize } from "@/lib/dev/authorize";
import { query, withTransaction } from "@/lib/database/sql";
import { sendTrackedSupportText } from "@/lib/services/supportWhatsApp";

jest.mock("@/lib/dev/authorize", () => ({authorize:jest.fn()}));
jest.mock("@/lib/database/sql", () => ({query:jest.fn(),withTransaction:jest.fn()}));
jest.mock("@/lib/services/supportWhatsApp", () => ({sendTrackedSupportText:jest.fn()}));
const id="30000000-0000-4000-8000-000000000001";
const originalUrl=process.env.IMENU_SUPPORT_PUBLIC_URL;
const lockedQuery=jest.fn();
const draft={id,review_status:"pending",reply_text:"Resposta editada",conversation_id:"conversation",session_name:"imenu-blast",chat_id:"5511999999999@c.us"};
function post(action:string){return POST(new Request("https://example.com/api/dev/support/drafts",{method:"POST",body:JSON.stringify({id,action})}));}
beforeEach(()=>{
 jest.resetAllMocks();
 process.env.IMENU_SUPPORT_PUBLIC_URL="https://www.imenuapp.com.br";
 (authorize as jest.Mock).mockResolvedValue(null);
 (withTransaction as jest.Mock).mockImplementation(callback=>callback({query:lockedQuery}));
 lockedQuery.mockResolvedValue({rows:[draft],rowCount:1});
 (sendTrackedSupportText as jest.Mock).mockResolvedValue(true);
 (query as jest.Mock).mockResolvedValue({rows:[{total:1}],rowCount:1});
});
afterAll(()=>{if(originalUrl===undefined)delete process.env.IMENU_SUPPORT_PUBLIC_URL;else process.env.IMENU_SUPPORT_PUBLIC_URL=originalUrl;});
it("sends the saved text to the draft's WhatsApp session before marking approved",async()=>{
 const response=await post("approve");
 expect(response.status).toBe(200);
 expect(await response.json()).toEqual({ok:true,sent:true});
 expect(lockedQuery).toHaveBeenCalledWith(expect.stringContaining("FOR UPDATE OF d"),[id]);
 expect(sendTrackedSupportText).toHaveBeenCalledWith({conversationId:"conversation",sessionName:"imenu-blast",chatId:draft.chat_id,text:draft.reply_text,dedupeKey:`support:draft:${id}`,replaceUnsentText:true});
 expect(lockedQuery.mock.calls[1][0]).toContain("review_status='approved'");
 expect((sendTrackedSupportText as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(lockedQuery.mock.invocationCallOrder[1]);
});
it("does not send an already approved draft again",async()=>{
 lockedQuery.mockResolvedValue({rows:[{...draft,review_status:"approved"}]});
 expect((await post("approve")).status).toBe(409);
 expect(sendTrackedSupportText).not.toHaveBeenCalled();
});
it.each(["failed","blocked"])("leaves approval pending if delivery is %s",async kind=>{
 const log=jest.spyOn(console,"error").mockImplementation(()=>{});
 if(kind==="failed")(sendTrackedSupportText as jest.Mock).mockRejectedValue(new Error("WAHA unavailable"));
 else (sendTrackedSupportText as jest.Mock).mockResolvedValue(false);
 expect((await post("approve")).status).toBe(500);
 expect(lockedQuery).toHaveBeenCalledTimes(1);
 log.mockRestore();
});
it("rejects without sending WhatsApp",async()=>{
 expect((await post("reject")).status).toBe(200);
 expect(sendTrackedSupportText).not.toHaveBeenCalled();
 expect(query).toHaveBeenCalledWith(expect.stringContaining("review_status='pending'"),[id,"rejected"]);
});
it("keeps production and authorization guards",async()=>{
 process.env.IMENU_SUPPORT_PUBLIC_URL="http://localhost:3000";
 expect((await post("approve")).status).toBe(403);
 (authorize as jest.Mock).mockResolvedValue(new Response(null,{status:401}));
 expect((await post("approve")).status).toBe(401);
 expect(sendTrackedSupportText).not.toHaveBeenCalled();
});
it("loads inbound and delivered outbound context in chronological order",async()=>{
 const response=await GET(new Request(`https://example.com/api/dev/support/drafts?id=${id}`));
 expect(response.status).toBe(200);
 const sql=(query as jest.Mock).mock.calls[0][0];
 expect(sql).toContain("m.direction='inbound' OR m.send_status='sent'");
 expect(sql).toContain("LIMIT 40");
 expect(sql).toContain("ORDER BY created_at,id");
 expect((query as jest.Mock).mock.calls[0][1]).toEqual([id]);
});
it("lists the latest draft per contact with a matching distinct count",async()=>{
 const response=await GET(new Request("https://example.com/api/dev/support/drafts?status=pending&page=1"));
 expect(response.status).toBe(200);
 expect((query as jest.Mock).mock.calls[0][0]).toContain("DISTINCT ON (session_name,chat_id)");
 expect((query as jest.Mock).mock.calls[1][0]).toContain("DISTINCT ON(session_name,chat_id) review_status");
 expect((query as jest.Mock).mock.calls[0][0]).not.toContain("FROM support_ai_reply_drafts WHERE review_status");
 expect((query as jest.Mock).mock.calls[0][0]).toContain("WHERE d.review_status=$1");
 expect((query as jest.Mock).mock.calls[0][1]).toEqual(["pending",25,25]);
});

it("loads a human handoff conversation without requiring an AI draft",async()=>{
 const response=await GET(new Request(`https://example.com/api/dev/support/drafts?conversation_id=${id}`));
 expect(response.status).toBe(200);
 expect(query).toHaveBeenCalledWith(expect.stringContaining("m.conversation_id=$1"),[id]);
 const sql=(query as jest.Mock).mock.calls[0][0];
 expect(sql).toContain("FROM support_messages m");
 expect(sql).not.toContain("JOIN support_ai_reply_drafts");
 expect(sql).toContain("m.direction='inbound' OR m.send_status='sent'");
});
it("rejects invalid conversation IDs without querying messages",async()=>{
 const response=await GET(new Request("https://example.com/api/dev/support/drafts?conversation_id=invalid"));
 expect(response.status).toBe(400);
 expect(query).not.toHaveBeenCalled();
});
it("requires admin authorization before exposing conversation context",async()=>{
 (authorize as jest.Mock).mockResolvedValue(new Response(null,{status:403}));
 const response=await GET(new Request(`https://example.com/api/dev/support/drafts?conversation_id=${id}`));
 expect(response.status).toBe(403);
 expect(query).not.toHaveBeenCalled();
});
