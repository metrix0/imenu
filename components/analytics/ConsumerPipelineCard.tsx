"use client";

import type { ConsumerPipelineStep } from "@/lib/analytics/consumerPipeline";

function formatCount(value: number): string {
    return value.toLocaleString("pt-BR");
}

function formatCurrencyFromCents(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
    }).format(value / 100);
}

export default function ConsumerPipelineCard({
    steps,
    postHogAvailable,
    showTrackingNotice = true,
}: {
    steps: ConsumerPipelineStep[];
    postHogAvailable: boolean;
    showTrackingNotice?: boolean;
}) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {steps.map((step, index) => (
                    <div
                        key={step.key}
                        className={`rounded-xl border p-4 ${
                            step.available
                                ? "border-gray-200 bg-white"
                                : "border-dashed border-gray-300 bg-gray-50"
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                                {index + 1}
                            </span>
                            <p className="text-sm font-medium text-gray-800">
                                {step.label}
                            </p>
                        </div>

                        <p className="mt-4 text-2xl font-bold">
                            {step.value === null
                                ? "—"
                                : step.valueType === "currency"
                                  ? formatCurrencyFromCents(step.value)
                                  : formatCount(step.value)}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                            {step.conversion !== null
                                ? `${step.conversion.toLocaleString(
                                      "pt-BR"
                                  )}% do passo anterior`
                                : step.note ||
                                  (step.available
                                      ? "Conversão indisponível"
                                      : "Evento ainda não conectado")}
                        </p>
                    </div>
                ))}
            </div>

            {showTrackingNotice && !postHogAvailable && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Os passos comportamentais começam a aparecer depois que o
                    PostHog estiver configurado e os novos eventos forem
                    recebidos. O total de pedidos continua vindo do Supabase.
                </div>
            )}
        </div>
    );
}
