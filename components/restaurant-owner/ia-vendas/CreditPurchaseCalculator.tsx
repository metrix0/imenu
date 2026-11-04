"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { faCoins } from "@fortawesome/free-solid-svg-icons";
import styles from "./CreditPurchaseCalculator.module.css";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import ModalFlowStep from "@/components/ui/ModalFlowStep";
import PaymentCheckout from "@/components/payments/PaymentCheckout";
import type { PaymentCheckoutInput } from "@/lib/payments/types";
import { supabase } from "@/lib/database/supabaseClient";
import {
  calculateCreditQuote,
  convertCreditCostToBrlCents,
  type CreditRates,
} from "@/lib/ia-vendas/creditMath";

type Prices = { rates: CreditRates; rate: number };
const count = (n: number) => n.toLocaleString("pt-BR");
const brl = (cents: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(cents / 100);

async function authenticatedPost(url: string, body: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Entre novamente para continuar.");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + session.access_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Não foi possível processar a compra.");
  return result;
}

export default function CreditPurchaseCalculator({
  restaurantId, onClose, onPaid,
}: {
  restaurantId: string;
  onClose: () => void;
  onPaid: () => void | Promise<void>;
}) {
  const [prices, setPrices] = useState<Prices | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inputTokens, setInputTokens] = useState(1_000_000);
  const [images, setImages] = useState(0);
  const [checkout, setCheckout] = useState(false);
  const [navigated, setNavigated] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [purchaseId, setPurchaseId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Entre novamente para consultar os preços.");
        const response = await fetch(
          "/api/ia-vendas/credits/quote?restaurant_id=" + encodeURIComponent(restaurantId),
          { cache: "no-store", headers: { Authorization: "Bearer " + session.access_token } },
        );
        const data = await response.json();
        if (!response.ok || !data.rates || !Number.isFinite(data.rate)) {
          throw new Error(data.error || "Não foi possível carregar os preços.");
        }
        if (active) {
          setInputTokens((current) => Math.min(current, data.rates.maxInputTokens));
          setImages((current) => Math.min(current, data.rates.maxImages));
          setPrices({ rates: data.rates, rate: data.rate });
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os preços.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [restaurantId]);

  const selectedInput = prices ? Math.min(inputTokens, prices.rates.maxInputTokens) : 0;
  const selectedImages = prices ? Math.min(images, prices.rates.maxImages) : 0;
  const quote = useMemo(
    () => prices ? calculateCreditQuote(prices.rates, selectedInput, selectedImages) : null,
    [prices, selectedInput, selectedImages],
  );
  const priceCents = prices && quote ? convertCreditCostToBrlCents(quote.totalUsd, prices.rate) : 0;
  const tokenCents = quote?.totalUsd
    ? Math.round(priceCents * (quote.inputUsd + quote.outputUsd) / quote.totalUsd) : 0;
  const imageCents = priceCents - tokenCents;

  const startPayment = useCallback(async (payment: PaymentCheckoutInput) => {
    if (payment.method !== "pix") throw new Error("Escolha o Pix para esta compra.");
    const result = await authenticatedPost("/api/ia-vendas/credits/checkout", {
      restaurant_id: restaurantId,
      requestId,
      inputTokens: selectedInput,
      images: selectedImages,
      priceCents,
      paymentMethod: "pix",
    });
    setPurchaseId(result.transactionId || null);
    return result;
  }, [restaurantId, requestId, selectedInput, selectedImages, priceCents]);

  const reconcilePayment = useCallback(async () => {
    if (!purchaseId) return { active: false, paymentStatus: "pending" };
    return authenticatedPost("/api/ia-vendas/credits/reconcile", {
      restaurant_id: restaurantId, purchaseId,
    });
  }, [restaurantId, purchaseId]);

  const paymentProduct = useMemo(() => ({
    name: "Créditos do Assistente IA",
    periodLabel: "Compra única",
    detail: [
      selectedInput ? count(selectedInput) + " entrada + " + count(quote?.outputTokens || 0) + " saída" : "",
      selectedImages ? count(selectedImages) + " imagens" : "",
    ].filter(Boolean).join(" · "),
    priceLabel: brl(priceCents),
    icon: faCoins,
    pixDescription: "Pagamento único",
    cardDescription: "",
    pixNotice: "Os créditos serão adicionados após a confirmação do Pix.",
    cardNotice: "",
    pixConfirmationDescription: "Os créditos serão liberados após a confirmação.",
    cardConfirmationDescription: "",
  }), [selectedInput, selectedImages, quote?.outputTokens, priceCents]);

  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
    {checkout && prices && quote ? (
      <ModalFlowStep key="checkout" animate>
        <PaymentCheckout
          key={requestId}
          product={paymentProduct}
          pixOnly
          onBack={() => setCheckout(false)}
          onClose={onClose}
          startPayment={startPayment}
          reconcilePayment={reconcilePayment}
          onPaid={onPaid}
        />
      </ModalFlowStep>
    ) : (
      <ModalFlowStep key="selection" reverse animate={navigated}>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
    <header className="shrink-0 border-b border-[#e2e5e9] px-6 py-5 sm:px-8">
      <h2 className="text-xl font-semibold text-[#1d1d1d]">Recarregar créditos</h2>
    </header>

    {loading ? (
      <div className="flex min-h-0 flex-1 items-center justify-center"><Loader /></div>
    ) : error || !prices || !quote ? (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <p role="alert" className="text-sm text-red-600">{error || "Preços indisponíveis."}</p>
      </div>
    ) : (
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-12 px-6 py-10 sm:px-8 md:py-14">
          <section aria-label="Tokens" className="space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base font-semibold text-[#1d1d1d]">Tokens</h3>
              <span className="text-lg font-semibold tabular-nums text-[#1d1d1d]">
                {count(selectedInput)}
              </span>
            </div>
            <input
              type="range"
              aria-label="Tokens de entrada"
              min={0}
              max={prices.rates.maxInputTokens}
              step={prices.rates.inputStep}
              value={selectedInput}
              onChange={(e) => setInputTokens(Number(e.target.value))}
              className={styles.range}
              style={{ "--range-progress": `${prices.rates.maxInputTokens ? selectedInput / prices.rates.maxInputTokens * 100 : 0}%` } as CSSProperties}
            />
            <div className="flex items-center justify-between text-xs text-[#626973]">
              <span>0</span><span>{count(prices.rates.maxInputTokens)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-[#626973]">
              <span>Saída incluída</span>
              <span className="font-medium tabular-nums text-[#1d1d1d]">{count(quote.outputTokens)}</span>
            </div>
          </section>

          <section aria-label="Imagens" className="space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base font-semibold text-[#1d1d1d]">Imagens</h3>
              <span className="text-lg font-semibold tabular-nums text-[#1d1d1d]">{count(selectedImages)}</span>
            </div>
            <input
              type="range"
              aria-label="Imagens"
              min={0}
              max={prices.rates.maxImages}
              step={1}
              value={selectedImages}
              onChange={(e) => setImages(Number(e.target.value))}
              className={styles.range}
              style={{ "--range-progress": `${prices.rates.maxImages ? selectedImages / prices.rates.maxImages * 100 : 0}%` } as CSSProperties}
            />
            <div className="flex items-center justify-between text-xs text-[#626973]">
              <span>0</span><span>{count(prices.rates.maxImages)}</span>
            </div>
          </section>
        </div>

        <aside className="border-t border-[#e2e5e9] bg-[#f7f8fa] px-6 py-8 sm:px-8 md:border-l md:border-t-0">
          <h3 className="text-base font-semibold text-[#1d1d1d]">Resumo</h3>
          <div className="mt-7 space-y-4 text-sm">
            <div className="flex justify-between gap-3 text-[#626973]">
              <span>Tokens</span><span className="tabular-nums text-[#1d1d1d]">{brl(tokenCents)}</span>
            </div>
            <div className="flex justify-between gap-3 text-[#626973]">
              <span>Imagens</span><span className="tabular-nums text-[#1d1d1d]">{brl(imageCents)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-[#e2e5e9] pt-4 font-semibold text-[#1d1d1d]">
              <span>Total</span><span className="text-xl tabular-nums">{brl(priceCents)}</span>
            </div>
          </div>
        </aside>
      </div>
    )}

    <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-[#e2e5e9] bg-white px-6 py-4 sm:px-8">
      <Button variant="secondary" onClick={onClose}>Cancelar</Button>
      <Button
        disabled={loading || !prices || !quote || !(selectedInput || selectedImages)}
        className="min-w-44"
        onClick={() => {
          setRequestId(crypto.randomUUID());
          setPurchaseId(null);
          setNavigated(true);
          setCheckout(true);
        }}
      >Continuar</Button>
    </footer>
        </div>
      </ModalFlowStep>
    )}
  </div>;
}
