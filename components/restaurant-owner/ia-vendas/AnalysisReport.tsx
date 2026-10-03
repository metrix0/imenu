"use client";
import { CircleHelp, ClipboardList, History, LoaderCircle, MessageSquare, Sparkles, Target, TrendingUp } from "lucide-react";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import SalesMarkdown from "./SalesMarkdown";
import { ActionCard, DataCard } from "./SalesWidgets";
import type { Action, Data } from "@/lib/ia-vendas/types";

const levels: Record<string, string> = { high: "alto", medium: "médio", low: "baixo" };
const confidenceLevels: Record<string, string> = { high: "alta", medium: "média", low: "baixa" };
const surface = "rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel-surface)]";
// Historical before/after results are intentionally hidden for now; keep the implementation for future use.
const SHOW_MEASUREMENT_HISTORY = false;

export default function AnalysisReport({
  analyses, selected, actions, refs, disabled, loading, generating,
  status, activeOpportunityId, onSelect, onDiscuss, onChat, onHistory, onAction, onBatch,
}: {
  analyses: Data[]; selected?: Data; actions: Action[]; refs: Record<string, string>;
  disabled: boolean; loading: boolean; generating: boolean;
  status: string; activeOpportunityId?: string;
  onSelect: (id: string) => void; onDiscuss: (item: Data) => void; onChat: () => void;
  onHistory: () => void; onAction: (command: string, ids: string[]) => void; onBatch: (ids: string[]) => void;
}) {
  const report = selected?.result?.report, legacy = selected && !report;
  const waiting = loading || generating;
  const opportunities: Data[] = report?.opportunities || [], reviewItems: Data[] = report?.review_items || [];
  const ids: string[] = report ? [...opportunities, ...reviewItems].flatMap((o) => o.action_ids)
    : actions.filter((a) => a.run_id === selected?.id).map((a) => a.id);
  const withGenerated = (ids: string[]): string[] => [
    ...new Set(ids.flatMap((id) => [id, ...(actions.find((a) => a.id === id)?.generated_actions || [])])),
  ];
  const pending = withGenerated(ids).filter((id) => actions.some((a) => a.id === id && a.status === "pending"));
  const renderActions = (entry: Data) => withGenerated(entry.action_ids).map((id) => {
    const action = actions.find((a) => a.id === id);
    return action ? <ActionCard key={id} action={action} refs={refs} disabled={disabled} onAction={onAction} compact /> : null;
  });
  const renderEvidence = (entry: Data, assessment = false) => entry.evidence?.length || assessment ? (
    <details className="mt-4 text-xs text-[var(--panel-muted)]">
      <summary className="cursor-pointer font-medium">{assessment ? "Ver detalhes e evidências" : `Ver evidências (${entry.evidence.length})`}</summary>
      {assessment && <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div><dt>Impacto esperado</dt><dd>{levels[entry.impact]}</dd></div>
        <div><dt>Confiança</dt><dd>{confidenceLevels[entry.confidence]}</dd></div>
        <div><dt>Esforço</dt><dd>{levels[entry.effort]}</dd></div>
        <div><dt>Risco</dt><dd>{levels[entry.risk]}</dd></div>
      </dl>}
      {!!entry.evidence?.length && <ul className="mt-3 list-disc space-y-2 pl-4">
        {entry.evidence.map((e: Data, i: number) => <li key={i}>{e.detail}</li>)}
      </ul>}
    </details>
  ) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-2" aria-busy={waiting}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1>Análise de vendas</h1>
          <p className="mt-2 text-sm text-[var(--panel-muted)]">As melhores oportunidades do seu restaurante, em um só lugar.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {analyses.length > 0 && <div className="w-full sm:w-72">
            <Dropdown aria-label="Histórico de análises" value={selected?.id || ""} disabled={disabled}
              onChange={(e) => onSelect(e.target.value)}
              options={[
                { value: "", label: "Visão atual" },
                ...analyses.map((a, i) => ({
                  value: a.id,
                  label: (i === 0 ? "Mais recente · " : "") + new Date(a.created_at).toLocaleString("pt-BR") + (a.status !== "completed" ? " · Não concluída" : ""),
                })),
              ]}
            />
          </div>}
          <Button variant="secondary" aria-label="Histórico de ações" title="Histórico de ações" onClick={onHistory}><History size={16} /></Button>
        </div>
      </header>

      {waiting && <div role="status" className={surface + " flex items-center gap-3 p-4"}>
        <LoaderCircle size={20} className="shrink-0 animate-spin text-[var(--panel-action)] motion-reduce:animate-none" />
        <div><p className="text-sm font-medium">{generating ? "Preparando seu relatório" : "Carregando análise"}</p>
          <p className="mt-1 text-xs text-[var(--panel-muted)]">{status || "Reunindo cardápio, vendas e oportunidades…"}</p>
        </div>
      </div>}
      {report?.status === "partial" && !generating && <div role="status" className="rounded-[10px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Esta análise não foi concluída. As propostas preparadas estão disponíveis para revisão.
      </div>}

      {!legacy && <section aria-label="Potencial estimado" className={surface + " overflow-hidden !bg-[var(--panel-tint)] p-5 md:p-6"}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0 [&>div]:!m-0 [&>div]:!border-0 [&>div]:!bg-transparent [&>div]:!p-0">
            <h2 className="mb-4 flex items-center gap-2 text-xl"><TrendingUp size={18} aria-hidden="true" />O que seu restaurante pode ganhar em 4 semanas</h2>
            {report ? <DataCard card={{...report.potential_estimate, hide_period_label: true, type: "potential"}} /> : <>
              <p className="text-3xl font-semibold text-[var(--panel-text)]">{waiting ? "Calculando…" : "A descobrir"}</p>
              <p className="mt-3 text-sm leading-6 text-[var(--panel-muted)]">Uma estimativa baseada nas oportunidades e nos pedidos do seu restaurante.</p>
            </>}
          </div>
          <div className="flex flex-wrap gap-2 lg:max-w-[420px] lg:justify-end">
            <Button disabled={disabled || !pending.length} onClick={() => onBatch(pending)}>Revisar e aplicar tudo</Button>
            <Button variant="secondary" disabled={disabled} onClick={onChat}><MessageSquare size={15} className="mr-2" />Conversar com Assistente de IA</Button>
          </div>
        </div>
      </section>}

      {!legacy && <section aria-label="Resumo da IA" className="grid gap-4 px-1 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--panel-accent-text)]"><Sparkles size={16} aria-hidden="true" />Resumo da IA</div>
        </div>
        <div className="min-w-0">
          <h2 className="mb-3">{report?.headline || (waiting ? "Encontrando oportunidades para vender mais" : "Seu próximo passo para vender mais")}</h2>
          {report ? <SalesMarkdown content={report.summary} /> : <p className="text-sm leading-6 text-[var(--panel-muted)]">
            A análise reúne os dados do seu restaurante e prioriza mudanças com impacto nas vendas. Cada oportunidade traz evidências e propostas para você revisar.
          </p>}
        </div>
      </section>}

      {!legacy && <section aria-label="Oportunidades prioritárias" className="space-y-4">
        <h3>Oportunidades prioritárias{report ? ` (${opportunities.length})` : ""}</h3>
        {!opportunities.length && <div className={surface + " flex flex-col items-center px-5 py-8 text-center"}>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[10px] bg-[var(--panel-tint)] text-[var(--panel-accent-text)]"><Target size={24} aria-hidden="true" /></div>
          <h4 className="text-base font-medium">{waiting ? "Avaliando as melhores oportunidades" : report ? "Nenhuma oportunidade priorizada" : "Sua análise estará disponível aqui"}</h4>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--panel-muted)]">
            {waiting ? "O relatório aparecerá aqui assim que a análise terminar." : report ? (report.status === "partial" ? "A priorização ainda não foi concluída. Veja as propostas preservadas nos pontos para revisão." : "Não encontramos mudanças de alto impacto sustentadas pelos dados atuais.") : "As oportunidades aparecerão aqui quando seu relatório estiver disponível."}
          </p>
        </div>}
        {!!opportunities.length && <div className={surface + " overflow-hidden"}>
          {opportunities.map((o, i) => <article key={o.id} className={"p-5 md:p-6 " + (i ? "border-t border-[var(--panel-border)] " : "") + (activeOpportunityId === o.id ? "bg-[var(--panel-tint)]" : "")}>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(360px,1.15fr)] xl:gap-8">
              <div className="min-w-0">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--panel-tint)] text-sm font-medium text-[var(--panel-accent-text)]">{i + 1}</span>
                  <div className="min-w-0 flex-1"><h4 className="text-base font-semibold">{o.title}</h4><p className="mt-2 text-sm leading-6 text-[var(--panel-muted)]">{o.explanation}</p></div>
                </div>
                {renderEvidence(o, true)}
              </div>
              <div className="min-w-0 xl:border-l xl:border-[var(--panel-border)] xl:pl-8">
                {renderActions(o)}
                <div className="mt-3 flex justify-end"><Button variant="secondary" disabled={disabled} aria-pressed={activeOpportunityId === o.id} onClick={() => onDiscuss(o)}><MessageSquare size={15} className="mr-2" />Conversar sobre isso</Button></div>
              </div>
            </div>
          </article>)}
        </div>}
      </section>}

      {!!reviewItems.length && <details className={surface + " p-5"}>
        <summary className="flex cursor-pointer items-start gap-2 text-sm font-medium">
          <CircleHelp size={16} className="mt-0.5 shrink-0 text-[var(--panel-muted)]" />
          <span>Pontos para revisão ({reviewItems.length})<span className="mt-1 block text-xs font-normal text-[var(--panel-muted)]">{reviewItems[0].title}</span></span>
        </summary>
        <div className="mt-4 space-y-5">{reviewItems.map((o) => <article key={o.id} className="border-t border-[var(--panel-border)] pt-4">
          <h4 className="text-sm font-medium">{o.title}</h4><p className="mt-2 text-sm leading-6 text-[var(--panel-muted)]">{o.explanation}</p>
          {renderActions(o)}{renderEvidence(o)}
          <Button variant="secondary" className="mt-3" disabled={disabled} onClick={() => onDiscuss(o)}><MessageSquare size={15} className="mr-2" />Conversar sobre isso</Button>
        </article>)}</div>
      </details>}

      {!legacy && <section aria-label={SHOW_MEASUREMENT_HISTORY ? "Comparações e resultados" : "Comparações"} className="space-y-4">
        <h3>{SHOW_MEASUREMENT_HISTORY ? "Comparações e resultados" : "Comparações"}</h3>
        <div className={`grid gap-4 ${SHOW_MEASUREMENT_HISTORY ? "2xl:grid-cols-2" : ""}`}>
          {report ? <div className="min-w-0 [&>details]:!m-0">
            <DataCard card={{...report.benchmark_snapshot, reason: report.benchmark_snapshot?.reason || "Ainda não há dados suficientes para uma comparação útil.", type:"benchmark"}} expanded />
          </div> : <div className={surface + " min-w-0 p-5"}>
            <div className="mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-[var(--panel-muted)]" /><h4 className="text-sm font-medium">Restaurantes semelhantes</h4></div>
            <p className="text-sm leading-6 text-[var(--panel-muted)]">Compare suas vendas com restaurantes parecidos quando houver dados suficientes.</p>
          </div>}
          {SHOW_MEASUREMENT_HISTORY && <div className="min-w-0 [&>details]:!m-0">
            {report?.measurement_snapshot?.results?.some((r: Data) => r.before.orders || r.after.orders) ? <DataCard card={{...report.measurement_snapshot, type:"measurement"}} expanded /> : <div className={surface + " p-5"}>
              <div className="mb-3 flex items-center gap-2"><ClipboardList size={16} className="text-[var(--panel-muted)]" /><h4 className="text-sm font-medium">Resultados das mudanças</h4></div>
              <p className="text-sm leading-6 text-[var(--panel-muted)]">{report?.measurement_snapshot?.reason || report?.measurement_snapshot?.note || "Ainda não há vendas suficientes após as mudanças para comparar os resultados."}</p>
            </div>}
          </div>}
        </div>
      </section>}
      {legacy && <section className={surface + " space-y-4 p-5"}>
        <p className="text-xs text-[var(--panel-muted)]">Relatório anterior ao formato estruturado.</p>
        <SalesMarkdown content={String(selected.result.reply || "").replace(/\[\[(?:action:[^\]]+|card:[^\]]+)\]\]/g, "")} />
        {actions.filter((a) => a.run_id === selected.id).map((a) => <ActionCard key={a.id} action={a} refs={refs} disabled={disabled} onAction={onAction} />)}
      </section>}
    </div>
  );
}
