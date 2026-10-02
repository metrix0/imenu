"use client";
import Button from "@/components/ui/Button";
import SalesMarkdown from "./SalesMarkdown";
import { ActionCard, DataCard } from "./SalesWidgets";
import type { Action, Data } from "@/lib/ia-vendas/types";

const levels: Record<string, string> = {
  high: "alto",
  medium: "médio",
  low: "baixo",
};
export default function AnalysisReport({
  analyses,
  selected,
  actions,
  refs,
  disabled,
  availableAt,
  onSelect,
  onAnalyze,
  onDiscuss,
  onAction,
  onBatch,
}: {
  analyses: Data[];
  selected?: Data;
  actions: Action[];
  refs: Record<string, string>;
  disabled: boolean;
  availableAt: string | null;
  onSelect: (id: string) => void;
  onAnalyze: () => void;
  onDiscuss: (item: Data) => void;
  onAction: (command: string, ids: string[]) => void;
  onBatch: (ids: string[]) => void;
}) {
  const report = selected?.result?.report;
  const legacy = selected && !report;
  const ids: string[] = report
    ? [...report.opportunities, ...report.review_items].flatMap(
        (o: Data) => o.action_ids,
      )
    : actions.filter((a) => a.run_id === selected?.id).map((a) => a.id);
  const withGenerated = (ids: string[]): string[] => [
    ...new Set(
      ids.flatMap((id) => [
        id,
        ...(actions.find((a) => a.id === id)?.generated_actions || []),
      ]),
    ),
  ];
  const pending = withGenerated(ids).filter((id) =>
    actions.some((a) => a.id === id && a.status === "pending"),
  );
  const cooldown = !!availableAt && Date.parse(availableAt) > Date.now();
  const renderActions = (entry: Data) =>
    withGenerated(entry.action_ids).map((id: string) => {
      const action = actions.find((a) => a.id === id);
      return action ? (
        <ActionCard
          key={id}
          action={action}
          refs={refs}
          disabled={disabled}
          onAction={onAction}
        />
      ) : null;
    });
  const renderEvidence = (entry: Data) =>
    entry.evidence?.length ? (
      <details className="mt-3 text-xs text-gray-500">
        <summary className="cursor-pointer">
          Dados que sustentam esta oportunidade
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {entry.evidence.map((e: Data, i: number) => (
            <li key={i}>{e.detail}</li>
          ))}
        </ul>
      </details>
    ) : null;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">Análise de vendas</p>
            <h2 className="mt-1 text-xl font-semibold">
              {report?.headline ||
                (legacy
                  ? "Análise anterior"
                  : "O próximo passo para vender mais")}
            </h2>
          </div>
          <Button
            variant="secondary"
            disabled={disabled || cooldown}
            onClick={onAnalyze}
          >
            {selected ? "Nova análise" : "Analisar meu restaurante"}
          </Button>
        </div>
        {cooldown && (
          <p className="text-xs text-gray-500">
            Nova análise disponível em{" "}
            {new Date(availableAt!).toLocaleDateString("pt-BR")}. Converse sobre
            as recomendações enquanto observa os resultados.
          </p>
        )}
        {analyses.length > 0 && (
          <label className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            Histórico de análises
            <select
              aria-label="Histórico de análises"
              value={selected?.id || ""}
              disabled={disabled}
              onChange={(e) => onSelect(e.target.value)}
              className="max-w-full rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel-surface)] p-2 text-sm text-gray-700"
            >
              {analyses.map((a, i) => (
                <option key={a.id} value={a.id}>
                  {i === 0 ? "Mais recente · " : ""}
                  {new Date(a.created_at).toLocaleString("pt-BR")}
                  {a.status !== "completed" ? " · Não concluída" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      {!selected && (
        <p className="text-sm leading-6 text-gray-500">
          A IA examina seu cardápio, suas vendas e suas configurações para
          priorizar melhorias com impacto. Você revisa e aprova cada mudança.
        </p>
      )}
      {report && (
        <>
          {report.status === "partial" && (
            <p
              role="status"
              className="rounded-[10px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
            >
              Esta análise não foi concluída. As propostas preparadas estão
              disponíveis para revisão.
            </p>
          )}
          <SalesMarkdown content={report.summary} />
          {pending.length > 1 && (
            <Button disabled={disabled} onClick={() => onBatch(pending)}>
              Revisar e aplicar todos ({pending.length})
            </Button>
          )}
          <section
            aria-label="Oportunidades prioritárias"
            className="space-y-4"
          >
            <h3 className="font-semibold">Oportunidades prioritárias</h3>
            {!report.opportunities.length && (
              <p className="text-sm text-gray-500">
                {report.status === "partial"
                  ? "A priorização ainda não foi concluída."
                  : "Não encontramos mudanças de alta alavancagem sustentadas pelos dados atuais."}
              </p>
            )}
            {report.opportunities.map((o: Data, i: number) => (
              <article
                key={o.id}
                className="rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel-surface)] p-4"
              >
                <h4 className="font-semibold">
                  {i + 1}. {o.title}
                </h4>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {o.explanation}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Impacto {levels[o.impact]} · Confiança {levels[o.confidence]}{" "}
                  · Esforço {levels[o.effort]} · Risco {levels[o.risk]}
                </p>
                {renderEvidence(o)}
                {renderActions(o)}
                <Button
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => onDiscuss(o)}
                >
                  Conversar sobre isso
                </Button>
              </article>
            ))}
          </section>
          <section aria-label="Potencial e resultados">
            <h3 className="font-semibold">Potencial e resultados</h3>
            <DataCard
              card={{ ...report.potential_estimate, type: "potential" }}
            />
            <DataCard
              card={{ ...report.benchmark_snapshot, type: "benchmark" }}
            />
            <DataCard
              card={{ ...report.measurement_snapshot, type: "measurement" }}
            />
            {!report.measurement_snapshot.results?.length && (
              <p className="my-3 text-xs text-gray-500">
                {report.measurement_snapshot.reason ||
                  "Ainda não há mudanças aplicadas com tempo suficiente para comparar resultados."}
              </p>
            )}
          </section>
          {!!report.review_items.length && (
            <details className="rounded-[10px] border border-[var(--panel-border)] p-4">
              <summary className="cursor-pointer text-sm font-medium">
                Decisões e pontos para revisão ({report.review_items.length})
              </summary>
              <div className="mt-4 space-y-4">
                {report.review_items.map((o: Data) => (
                  <article key={o.id}>
                    <h4 className="text-sm font-medium">{o.title}</h4>
                    <p className="mt-1 text-sm text-gray-500">
                      {o.explanation}
                    </p>
                    {renderEvidence(o)}
                    {renderActions(o)}
                    <Button
                      variant="secondary"
                      disabled={disabled}
                      onClick={() => onDiscuss(o)}
                    >
                      Conversar sobre isso
                    </Button>
                  </article>
                ))}
              </div>
            </details>
          )}
          <p className="text-xs text-gray-400">
            Gerada em {new Date(report.generated_at).toLocaleString("pt-BR")}
            {report.period.start &&
              ` · Período: ${new Date(report.period.start).toLocaleDateString("pt-BR")} a ${new Date(report.period.end).toLocaleDateString("pt-BR")}`}
          </p>
        </>
      )}
      {legacy && (
        <section className="space-y-4">
          <p className="text-xs text-gray-500">
            Relatório anterior ao formato estruturado.
          </p>
          <SalesMarkdown
            content={String(selected.result.reply || "").replace(
              /\[\[(?:action:[^\]]+|card:[^\]]+)\]\]/g,
              "",
            )}
          />
          {actions
            .filter((a) => a.run_id === selected.id)
            .map((a) => (
              <ActionCard
                key={a.id}
                action={a}
                refs={refs}
                disabled={disabled}
                onAction={onAction}
              />
            ))}
        </section>
      )}
    </div>
  );
}
