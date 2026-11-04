"use client";

import { useEffect, useState } from "react";
import { ImageIcon, Coins } from "lucide-react";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { supabase } from "@/lib/database/supabaseClient";
import { calculateCreditQuote, type CreditRates } from "@/lib/ia-vendas/creditMath";

const formatNumber = (value: number) => value.toLocaleString("pt-BR");
const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);

export default function CreditPurchaseCalculator({
  open,
  restaurantId,
  onClose,
}: {
  open: boolean;
  restaurantId: string;
  onClose: () => void;
}) {
  const [rates, setRates] = useState<CreditRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inputTokens, setInputTokens] = useState(1_000_000);
  const [images, setImages] = useState(0);

  useEffect(() => {
    if (!open || !restaurantId) return;
    let active = true;
    setLoading(true);
    setError("");

    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Entre novamente para consultar os valores.");
        const response = await fetch(
          "/api/ia-vendas/credits/quote?restaurant_id=" + encodeURIComponent(restaurantId),
          {
            headers: { Authorization: "Bearer " + session.access_token },
            cache: "no-store",
          },
        );
        const result = await response.json();
        if (!response.ok || !result.rates) {
          throw new Error(result.error || "Não foi possível consultar os valores.");
        }
        if (active) setRates(result.rates);
      } catch (cause) {
        if (active) {
          setRates(null);
          setError(cause instanceof Error ? cause.message : "Não foi possível consultar os valores.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [open, restaurantId]);

  const quote = rates ? calculateCreditQuote(rates, inputTokens, images) : null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Recarregar créditos</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Escolha quantos tokens e imagens deseja adicionar ao Assistente IA.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center"><Loader /></div>
      ) : error || !rates || !quote ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error || "Preços temporariamente indisponíveis."}
        </p>
      ) : (
        <>
          <section className="rounded-[10px] border border-[#e2e5e9] bg-white p-4" aria-label="Tokens adicionais">
            <div className="mb-3 flex items-center gap-2">
              <Coins size={18} className="text-brand" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-gray-900">Tokens</h3>
              <strong className="ml-auto text-sm tabular-nums text-gray-900">
                {formatNumber(inputTokens)} entrada
              </strong>
            </div>
            <input
              type="range"
              aria-label="Tokens de entrada adicionais"
              min={0}
              max={rates.maxInputTokens}
              step={rates.inputStep}
              value={inputTokens}
              onChange={(event) => setInputTokens(Number(event.target.value))}
              className="w-full cursor-pointer accent-[#d93d00]"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-500">
              <span>0</span><span>{formatNumber(rates.maxInputTokens)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-[8px] bg-[#f7f8fa] px-3 py-2 text-sm">
              <span className="text-gray-600">Tokens de saída incluídos</span>
              <strong className="tabular-nums text-gray-900">
                {formatNumber(quote.outputTokens)}
              </strong>
            </div>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              Saída calculada automaticamente pela proporção atual do Assistente IA ({Math.round(rates.outputRatio * 100)}%).
            </p>
          </section>

          <section className="rounded-[10px] border border-[#e2e5e9] bg-white p-4" aria-label="Imagens adicionais">
            <div className="mb-3 flex items-center gap-2">
              <ImageIcon size={18} className="text-brand" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-gray-900">Imagens</h3>
              <strong className="ml-auto text-sm tabular-nums text-gray-900">
                {formatNumber(images)}
              </strong>
            </div>
            <input
              type="range"
              aria-label="Imagens adicionais"
              min={0}
              max={rates.maxImages}
              step={1}
              value={images}
              onChange={(event) => setImages(Number(event.target.value))}
              className="w-full cursor-pointer accent-[#d93d00]"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-500">
              <span>0</span><span>{formatNumber(rates.maxImages)}</span>
            </div>
          </section>

          <section className="rounded-[10px] bg-[#f7f8fa] p-4" aria-label="Resumo dos valores">
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between gap-2">
                <span>Entrada · {formatNumber(quote.inputTokens)} tokens</span>
                <span className="tabular-nums">{formatUsd(quote.inputUsd)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Saída · {formatNumber(quote.outputTokens)} tokens</span>
                <span className="tabular-nums">{formatUsd(quote.outputUsd)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Imagens · {formatNumber(quote.images)}</span>
                <span className="tabular-nums">{formatUsd(quote.imagesUsd)}</span>
              </div>
            </div>
            <div className="mt-3 flex justify-between border-t border-[#e2e5e9] pt-3">
              <strong className="text-sm text-gray-900">Custo estimado (USD)</strong>
              <strong className="text-lg tabular-nums text-gray-900">{formatUsd(quote.totalUsd)}</strong>
            </div>
          </section>

          <p className="text-xs leading-5 text-gray-500">
            Estimativa com base nos custos de API dos modelos atuais. O valor real de uma imagem
            depende do tamanho, da referência e do processamento. Não é um preço de venda.
          </p>
        </>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Fechar</Button>
        <Button disabled>Pagamento em breve</Button>
      </div>
    </div>
  );
}
