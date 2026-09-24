import { after } from "next/server";
import { authorize, failure } from "@/lib/ia-vendas/http";
import { runChat } from "@/lib/ia-vendas/chat";
import { isUuid } from "@/lib/ia-vendas/catalog";
import { SalesError } from "@/lib/ia-vendas/types";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    const b = await request.json(),
      restaurant = await authorize(request, b.restaurant_id);
    if (
      !isUuid(b.conversation_id) ||
      !isUuid(b.run_id) ||
      typeof b.text !== "string" ||
      !b.text.trim() ||
      b.text.length > 8000 ||
      !Array.isArray(b.attachments) ||
      b.attachments.length > 3 ||
      !b.attachments.every(isUuid)
    )
      throw new SalesError("Mensagem inválida.");
    const encoder = new TextEncoder();
    let task: Promise<void>;
    const stream = new ReadableStream({
      start(controller) {
        let closed = false;
        const send = (event: string, data: any) => {
          if (closed) return;
          try {
            controller.enqueue(
              encoder.encode(
                `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
              ),
            );
          } catch {
            closed = true;
          }
        };
        const heartbeat = setInterval(() => send("ping", {}), 15000);
        task = runChat({
          restaurant,
          conversation: b.conversation_id,
          run: b.run_id,
          text: b.text.trim(),
          attachments: b.attachments,
          deep: b.deep === true,
          send,
        }).finally(() => {
          clearInterval(heartbeat);
          if (!closed) {
            closed = true;
            try {
              controller.close();
            } catch {}
          }
        });
      },
    });
    after(async () => {
      await task;
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
