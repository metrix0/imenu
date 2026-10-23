import { NextRequest, NextResponse } from "next/server";
import {
  requireRestaurantOwner,
  RestaurantOwnerAuthError,
} from "@/lib/auth/restaurantOwner";
import { listCustomers, customerDetails } from "@/lib/services/crm";
import { normalizeCustomerPhone } from "@/lib/services/crmRules";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams,
      id = p.get("restaurantId") || "";
    await requireRestaurantOwner(request, id);
    const phone = normalizeCustomerPhone(p.get("phone"));
    const result = phone
      ? await customerDetails(id, phone)
      : await listCustomers(
          id,
          p.get("search") || "",
          p.get("segment") || "",
          Math.max(1, Math.min(10000, Number(p.get("page")) || 1)),
        );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof RestaurantOwnerAuthError
            ? error.message
            : "Não foi possível carregar os clientes.",
      },
      {
        status: error instanceof RestaurantOwnerAuthError ? error.status : 500,
      },
    );
  }
}
