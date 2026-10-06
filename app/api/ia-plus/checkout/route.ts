import { IA_PLUS } from "@/lib/addons/products";
import { checkoutAddon } from "@/lib/addons/checkout";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return checkoutAddon(request, IA_PLUS); }
