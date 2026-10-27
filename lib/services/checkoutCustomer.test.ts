import { NextResponse } from "next/server";
import {
  trustCustomer,
  trustedPhone,
  customerCookie,
  structuredAddress,
  savedCheckoutProfile,
} from "./checkoutCustomer";
const id = "30000000-0000-4000-8000-000000000001";
beforeEach(() => {
  process.env.CRON_SECRET = "isolated-checkout-test-secret";
});
test("autofill accepts only a signed phone for the same restaurant", () => {
  const response = trustCustomer(
    NextResponse.json({ ok: true }),
    id,
    "19999991234",
  );
  const cookie = response.cookies.get(customerCookie(id))!;
  const request = new Request("https://test.invalid", {
    headers: { cookie: `${cookie.name}=${cookie.value}` },
  });
  expect(trustedPhone(request, id)).toBe("5519999991234");
  expect(trustedPhone(request, "other-restaurant")).toBeNull();
  const [payload, signature] = cookie.value.split(".");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString());
  data.phone = "5511111111111";
  const forged = new Request("https://test.invalid", {
    headers: {
      cookie: `${cookie.name}=${Buffer.from(JSON.stringify(data)).toString("base64url")}.${signature}`,
    },
  });
  expect(trustedPhone(forged, id)).toBeNull();
});
test("address input is limited to known checkout fields", () => {
  expect(
    structuredAddress({ rua: "Rua A", numero: "1", injected: "secret" }),
  ).not.toHaveProperty("injected");
  expect(structuredAddress({ formatted: "unstructured" })).toBeNull();
});

test("placing an order remembers only submitted data and does not verify the phone", () => {
  const response = trustCustomer(
    NextResponse.json({ ok: true }),
    id,
    "19999991234",
    { name: "Submitted name", address: null },
  );
  const cookie = response.cookies.get(customerCookie(id));
  const request = new Request("https://test.invalid", {
    headers: { cookie: `${cookie!.name}=${cookie!.value}` },
  });
  expect(trustedPhone(request, id)).toBeNull();
  expect(savedCheckoutProfile(request, id)?.snapshot?.name).toBe(
    "Submitted name",
  );
});
