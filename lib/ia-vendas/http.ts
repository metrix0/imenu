import {
  getAuthenticatedUser,
  requireRestaurantOwner,
  RestaurantOwnerAuthError,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import { isUuid } from "./catalog";
import { SalesError } from "./types";
export async function authorize(request: Request, requested?: string | null) {
  let id = requested;
  if (!id) {
    const user = await getAuthenticatedUser(request);
    id = (
      await query(
        "SELECT id FROM public.restaurants WHERE user_id=$1 ORDER BY created_at LIMIT 1",
        [user.id],
      )
    ).rows[0]?.id;
  }
  if (!id || !isUuid(id))
    throw new SalesError("Restaurante não encontrado.", 404);
  await requireRestaurantOwner(request, id);
  return id;
}
export function failure(e: unknown) {
  return Response.json(
    {
      error:
        e instanceof SalesError || e instanceof RestaurantOwnerAuthError
          ? e.message
          : "Não foi possível concluir a operação.",
    },
    {
      status:
        e instanceof SalesError || e instanceof RestaurantOwnerAuthError
          ? e.status
          : 500,
    },
  );
}
