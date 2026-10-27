import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST() {
  return NextResponse.json({ error: "O iMenu QR Code Mesa agora é gratuito. Não há pagamento a confirmar." }, { status: 410 });
}
