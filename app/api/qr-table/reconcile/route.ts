import { ADDON_PRODUCTS } from "@/lib/addons/products";
import { reconcileAddon } from "@/lib/addons/reconcile";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return reconcileAddon(request, ADDON_PRODUCTS.qr_code_mesa); }
