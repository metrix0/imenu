import { authorize, failure } from "@/lib/ia-vendas/http";
import { saveFile, signedAttachment } from "@/lib/ia-vendas/files";
import { SalesError } from "@/lib/ia-vendas/types";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const form = await request.formData(),
      restaurant = await authorize(
        request,
        String(form.get("restaurant_id") || ""),
      ),
      file = form.get("file");
    if (!(file instanceof File) || file.size > 8388608)
      throw new SalesError("Envie um arquivo de até 8 MB.");
    let mime = file.type;
    if (!mime && /\.(txt|md|csv)$/i.test(file.name))
      mime = file.name.endsWith(".csv") ? "text/csv" : "text/plain";
    const saved = await saveFile(
      restaurant,
      file.name,
      mime,
      Buffer.from(await file.arrayBuffer()),
    );
    return Response.json(await signedAttachment(restaurant, saved.id));
  } catch (e) {
    return failure(e);
  }
}
