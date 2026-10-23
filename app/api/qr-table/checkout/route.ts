import { ADDON_PRODUCTS } from "@/lib/addons/products";
import { checkoutAddon } from "@/lib/addons/checkout";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return checkoutAddon(request, ADDON_PRODUCTS.qr_code_mesa); }
