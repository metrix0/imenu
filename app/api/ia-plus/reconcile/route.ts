import { IA_PLUS } from "@/lib/addons/products";
import { reconcileAddon } from "@/lib/addons/reconcile";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return reconcileAddon(request, IA_PLUS); }
