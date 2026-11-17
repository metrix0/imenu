import { NextRequest, NextResponse } from "next/server";
import {
  requireRestaurantOwner,
  RestaurantOwnerAuthError,
} from "@/lib/auth/restaurantOwner";
import { listCustomers, customerDetails, deleteCustomer } from "@/lib/services/crm";
import { isUuid } from "@/lib/promotions/automatic";
import { normalizeCustomerPhone } from "@/lib/services/crmRules";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams,
      id = p.get("restaurantId") || "";
    await requireRestaurantOwner(request, id);
    const phone = normalizeCustomerPhone(p.get("phone"));
    const result = phone
      ? await customerDetails(id, phone, Math.max(1, Math.min(10000, Number(p.get("orderPage")) || 1)))
      : await listCustomers(
          id,
          p.get("search") || "",
          p.get("segment") || "",
          Math.max(1, Math.min(10000, Number(p.get("page")) || 1)),
          p.get("orders") || "",
          p.get("sort") || "last:desc",
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

export async function DELETE(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const id = params.get("restaurantId") ?? "";
    const phone = normalizeCustomerPhone(params.get("phone"));
    if (!isUuid(id) || !phone) {
      return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
    }
    await requireRestaurantOwner(request, id);
    await deleteCustomer(id, phone);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RestaurantOwnerAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Não foi possível excluir o cliente." }, { status: 500 });
  }
}
