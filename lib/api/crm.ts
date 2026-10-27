import { supabase } from "@/lib/database/supabaseClient";
export async function crmRequest(
  path: string,
  restaurantId: string,
  init: RequestInit = {},
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sua sessão expirou. Entre novamente.");
  const response = await fetch(
    `${path}${path.includes("?") ? "&" : "?"}restaurantId=${encodeURIComponent(restaurantId)}`,
    {
      ...init,
      cache: "no-store",
      headers: {
        ...init.headers,
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Não foi possível concluir a solicitação.");
  return data;
}
