import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { normalizeCustomerPhone } from "./crmRules";

export const checkoutCookie = (id: string) => `imenu_cart_${id}`;
export const customerCookie = (id: string) => `imenu_customer_${id}`;
export const otpCookie = (id: string) => `imenu_otp_${id}`;
export function readCookie(request: Request, name: string): string {
  return (
    request.headers
      .get("cookie")
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ""
  );
}
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
export function checkoutSignature(value: string): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("Checkout signing is not configured");
  return createHmac("sha256", secret)
    .update(`imenu-customer:${value}`)
    .digest("hex");
}
export function sameSignature(a: string, b: string) {
  return (
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
export function trustCustomer(
  response: NextResponse,
  restaurantId: string,
  value: unknown,
  snapshot?: { name: string | null; address: Record<string, string> | null },
) {
  const phone = normalizeCustomerPhone(value);
  if (!phone || !process.env.CRON_SECRET) return response;
  const payload = Buffer.from(
    JSON.stringify({
      phone,
      restaurantId,
      exp: Date.now() + 180 * 86400000,
      verified: !snapshot,
      ...(snapshot ? { snapshot } : {}),
    }),
  ).toString("base64url");
  response.cookies.set(
    customerCookie(restaurantId),
    `${payload}.${checkoutSignature(payload)}`,
    { ...cookieOptions, maxAge: 180 * 86400 },
  );
  return response;
}
export function savedCheckoutProfile(
  request: Request,
  restaurantId: string,
): {
  phone: string;
  verified: boolean;
  snapshot?: { name: string | null; address: Record<string, string> | null };
} | null {
  try {
    const [payload, sig] = readCookie(
      request,
      customerCookie(restaurantId),
    ).split(".");
    if (!payload || !sig || !sameSignature(checkoutSignature(payload), sig))
      return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.restaurantId === restaurantId &&
      data.exp > Date.now() &&
      normalizeCustomerPhone(data.phone)
      ? data
      : null;
  } catch {
    return null;
  }
}
export function trustedPhone(
  request: Request,
  restaurantId: string,
): string | null {
  const saved = savedCheckoutProfile(request, restaurantId);
  return saved?.verified ? saved.phone : null;
}
export function validCheckoutOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
export function structuredAddress(
  value: unknown,
): Record<string, string> | null {
  if (!value || typeof value !== "object") return null;
  const result: Record<string, string> = {};
  for (const key of [
    "cep",
    "rua",
    "bairro",
    "numero",
    "cidade",
    "estado",
    "complemento",
  ])
    result[key] = String((value as Record<string, unknown>)[key] || "")
      .trim()
      .slice(0, 200);
  return result.rua && result.numero ? result : null;
}
