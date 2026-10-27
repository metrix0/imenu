"use client";
import { useEffect, useRef, useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
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
    consent = useCheckoutStore((s) => s.marketingConsent),
    setField = useCheckoutStore((s) => s.setField);
  const [needsVerification, setNeedsVerification] = useState(false),
    [codeSent, setCodeSent] = useState(false),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const current = normalizeCustomerPhone(phone);
  const applyProfile = async (
    customer: { name?: string; address?: Record<string, string> } | null,
  ) => {
    if (!customer) {
      setMessage(
        "Nenhum dado salvo ainda. Preencha abaixo para seu próximo pedido.",
      );
      return;
    }
    const state = useCheckoutStore.getState();
    if (customer.name) state.setField("nome", customer.name);
    const address = customer.address?.rua
      ? { ...customer.address }
      : legacyCheckoutAddress(customer.address?.formatted);
    if (address) {
      const sourcePhone = normalizeCustomerPhone(state.celular);
      if ((!address.cidade || !address.estado) && address.cep) {
        const postal = await fetchAddressByCEP(address.cep);
        if (
          normalizeCustomerPhone(useCheckoutStore.getState().celular) !==
          sourcePhone
        )
          return;
        if (postal) {
          address.cidade = postal.city;
          address.estado = postal.state;
        }
      }
      // One update preserves street/number while forcing a fresh delivery quote.
      useCheckoutStore.setState({
        ...address,
        delivery_fee_cents: false,
        delivery_time_minutes: null,
      });
    }
    setMessage("Dados preenchidos. Confira o endereço antes de continuar.");
    setNeedsVerification(false);
    setCodeSent(false);
  };
  useEffect(() => {
    setNeedsVerification(false);
    setCodeSent(false);
    setCode("");
    setMessage("");
    if (!current) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch("/api/checkout/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ restaurantId, phone: current }),
      })
        .then(async (r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data || controller.signal.aborted) return;
          if (data.needsVerification) setNeedsVerification(true);
          else return applyProfile(data.customer);
        })
        .catch(() => undefined);
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [restaurantId, current]);
  async function verify(action: "send_code" | "verify") {
    if (busy || !current) return;
    const requestedPhone = current;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/checkout/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, phone: current, action, code }),
      });
      const data = await response.json();
      if (
        normalizeCustomerPhone(useCheckoutStore.getState().celular) !==
        requestedPhone
      )
        return;
      if (!response.ok)
        throw new Error(data.error || "Não foi possível recuperar os dados.");
      if (action === "send_code") {
        setCodeSent(true);
        setMessage("Código enviado para seu WhatsApp.");
      } else await applyProfile(data.customer);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Preencha seus dados manualmente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mb-6 space-y-3">
      <h2 className="font-semibold text-md 2xl:text-lg">Seus dados</h2>
      <Input
        autoComplete="tel"
        inputMode="tel"
        label="Celular"
        placeholder="(19) 99999-9999"
        value={phone}
        onChange={(e) => setField("celular", e.target.value)}
      />
      {needsVerification ? (
        <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          <p>
            Já pediu aqui? Confirme seu número para preencher seus dados
            automaticamente, ou preencha abaixo.
          </p>
          {codeSent ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Input
                label="Código do WhatsApp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
              <Button
                type="button"
                loading={busy}
                disabled={code.length !== 6}
                onClick={() => void verify("verify")}
              >
                Confirmar
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="mt-2"
              loading={busy}
              onClick={() => void verify("send_code")}
            >
              Preencher com WhatsApp
            </Button>
          )}
        </div>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-gray-600">
          {message}
        </p>
      ) : null}
      <Input
        autoComplete="name"
        label="Nome"
        placeholder="Como podemos chamar você?"
        value={name}
        onChange={(e) => setField("nome", e.target.value)}
      />
      <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          className="mt-1 accent-[#f14400]"
          checked={consent}
          onChange={(e) => setField("marketingConsent", e.target.checked)}
        />
        <span>
          Quero receber ofertas e lembretes deste restaurante pelo WhatsApp.
          Posso cancelar quando quiser.
        </span>
      </label>
    </div>
  );
}
