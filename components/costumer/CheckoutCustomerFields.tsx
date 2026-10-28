"use client";
import { useCallback, useEffect, useRef } from "react";
import Input from "@/components/ui/Input";
import { useCheckoutStore } from "@/lib/stores/costumer/checkoutStore";
import { fetchAddressByCEP } from "@/lib/api/geocoding";
import { useCartStore } from "@/lib/stores/costumer/cartStore";
import {
  normalizeCustomerPhone,
  legacyCheckoutAddress,
} from "@/lib/services/crmRules";

export function useCheckoutSession(restaurantId: string, enabled: boolean) {
  const items = useCartStore((s) => s.items),
    phone = useCheckoutStore((s) => s.celular),
    consent = useCheckoutStore((s) => s.marketingConsent);
  const queue = useRef(Promise.resolve());
  const tracked = useRef(false);
  useEffect(() => {
    if (
      !enabled ||
      !restaurantId ||
      (!normalizeCustomerPhone(phone) && !tracked.current)
    )
      return;
    if (!items.length && !tracked.current) return;
    const observedAt = Date.now();
    const timer = setTimeout(() => {
      tracked.current = true;
      const payload = {
        restaurantId,
        observedAt,
        phone,
        marketingConsent: consent,
        items: items.map((x) => ({
          base_item_id: x.base_item_id,
          qty: x.qty,
          unit_price_cents: x.unit_price_cents,
        })),
      };
      queue.current = queue.current
        .catch(() => undefined)
        .then(async () => {
          await fetch("/api/checkout/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive: true,
          });
        })
        .catch(() => undefined);
    }, 1500);
    return () => clearTimeout(timer);
  }, [restaurantId, enabled, phone, consent, items]);
}
export default function CheckoutCustomerFields({
  restaurantId,
}: {
  restaurantId: string;
}) {
  const phone = useCheckoutStore((s) => s.celular),
    name = useCheckoutStore((s) => s.nome),
    setField = useCheckoutStore((s) => s.setField);
  const lookupController = useRef<AbortController | null>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLookedUp = useRef<string | null>(null);
  const activeLookup = useRef<string | null>(null);

  const lookupCustomer = useCallback(async () => {
    const requestedPhone = normalizeCustomerPhone(useCheckoutStore.getState().celular);
    if (!requestedPhone || !restaurantId) return;
    const key = `${restaurantId}:${requestedPhone}`;
    if (lastLookedUp.current === key || activeLookup.current === key) return;

    lookupController.current?.abort();
    const controller = new AbortController();
    lookupController.current = controller;
    activeLookup.current = key;
    try {
      const response = await fetch("/api/checkout/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ restaurantId, phone: requestedPhone }),
      });
      if (!response.ok) return;
      const data = await response.json();
      if (
        controller.signal.aborted ||
        normalizeCustomerPhone(useCheckoutStore.getState().celular) !== requestedPhone
      ) return;
      lastLookedUp.current = key;
      if (!data?.customer) return;

      const customer = data.customer as {
        name?: string;
        address?: Record<string, string>;
      };
      if (customer.name) setField("nome", customer.name);
      const address = customer.address?.rua
        ? { ...customer.address }
        : legacyCheckoutAddress(customer.address?.formatted);
      if (!address) return;

      if ((!address.cidade || !address.estado) && address.cep) {
        const postal = await fetchAddressByCEP(address.cep);
        if (postal) {
          address.cidade = postal.city;
          address.estado = postal.state;
        }
      }
      if (
        controller.signal.aborted ||
        normalizeCustomerPhone(useCheckoutStore.getState().celular) !== requestedPhone
      ) return;
      useCheckoutStore.setState({
        ...address,
        delivery_fee_cents: false,
        delivery_time_minutes: null,
      });
    } catch {
      // No saved profile: customers can fill in their details normally.
    } finally {
      if (activeLookup.current === key) activeLookup.current = null;
    }
  }, [restaurantId, setField]);

  useEffect(() => {
    lookupController.current?.abort();
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!normalizeCustomerPhone(phone) || !restaurantId) return;
    lookupTimer.current = setTimeout(() => void lookupCustomer(), 600);
    return () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    };
  }, [phone, restaurantId, lookupCustomer]);

  useEffect(() => () => {
    lookupController.current?.abort();
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
  }, []);

  return (
    <div className="mb-6 space-y-3">
      <Input
        autoComplete="tel"
        inputMode="tel"
        label="Celular"
        placeholder="(19) 99999-9999"
        value={phone}
        onChange={(e) => setField("celular", e.target.value)}
        onBlur={() => {
          if (lookupTimer.current) clearTimeout(lookupTimer.current);
          void lookupCustomer();
        }}
        className="md:text-sm 2xl:text-lg"
      />
      <Input
        autoComplete="name"
        label="Nome"
        placeholder="Como podemos chamar você?"
        value={name}
        onChange={(e) => setField("nome", e.target.value)}
        className="md:text-sm 2xl:text-lg"
      />
    </div>
  );
}
