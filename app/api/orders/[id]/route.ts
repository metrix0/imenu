import { NextResponse } from "next/server";
import { query } from "@/lib/sql";

// ✅ FIXED for Next.js 15+ (params is a Promise)
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params; // unwrap the params Promise

    const { rows: [order] } = await query(
        `SELECT id, status FROM orders WHERE id = $1`,
        [id]
    );

    if (!order) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(order);
}


export async function PATCH(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params; // ✅ await the promise
    const { status } = await req.json();

    const allowed = ["paid", "preparing", "delivering", "done", "canceled"];
    if (!allowed.includes(status)) {
        return NextResponse.json({ error: "Invalid" }, { status: 400 });
    }

    console.log("Updating order:", id, "to status:", status);
    await query(`UPDATE orders SET status = $1 WHERE id = $2`, [status, id]);

    return NextResponse.json({ ok: true });
}