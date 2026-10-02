"use client";
import { Check, CircleHelp, ClipboardList, History, LoaderCircle, MessageSquare, Sparkles, Target, TrendingUp } from "lucide-react";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import SalesMarkdown from "./SalesMarkdown";
import { ActionCard, DataCard } from "./SalesWidgets";
import type { Action, Data } from "@/lib/ia-vendas/types";

const levels: Record<string, string> = { high: "alto", medium: "médio", low: "baixo" };
const confidenceLevels: Record<string, string> = { high: "alta", medium: "média", low: "baixa" };
const surface = "rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel-surface)]";

export default function AnalysisReport({
  analyses, selected, actions, refs, disabled, loading, generating,
  status, activeOpportunityId, onSelect, onDiscuss, onHistory, onAction, onBatch,
}: {
  analyses: Data[]; selected?: Data; actions: Action[]; refs: Record<string, string>;
  disabled: boolean; loading: boolean; generating: boolean;
  status: string; activeOpportunityId?: string;
  onSelect: (id: string) => void; onDiscuss: (item: Data) => void;
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
    return action ? <ActionCard key={id} action={action} refs={refs} disabled={disabled} onAction={onAction} /> : null;
  });
  const renderEvidence = (entry: Data) => entry.evidence?.length ? (
    <details className="mt-4 text-xs text-[var(--panel-muted)]">
      <summary className="cursor-pointer font-medium">Ver evidências ({entry.evidence.length})</summary>
      <ul className="mt-2 list-disc space-y-2 pl-4">
        {entry.evidence.map((e: Data, i: number) => <li key={i}>{e.detail}</li>)}
      </ul>
    </details>
  ) : null;
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-2" aria-busy={waiting}>
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1>Análise de vendas</h1>
            <p className="mt-2 text-sm text-[var(--panel-muted)]">As melhores oportunidades do seu restaurante, em um só lugar.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" aria-label="Histórico de ações" title="Histórico de ações" onClick={onHistory}><History size={16} /></Button>
          </div>
        </div>
        {analyses.length > 0 && <div className="flex justify-end">
          <div className="w-full max-w-sm">
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
          </div>
        </div>}
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

      {!legacy && <section aria-label="Resumo da IA" className={surface + " p-5"}>
          <div className="mb-4 flex items-center gap-2 text-xs font-medium text-[var(--panel-accent-text)]"><Sparkles size={16} aria-hidden="true" />Resumo da IA</div>
          <h2 className="mb-3">{report?.headline || (waiting ? "Encontrando oportunidades para vender mais" : "Seu próximo passo para vender mais")}</h2>
          {report ? <SalesMarkdown content={report.summary} /> : <p className="text-sm leading-6 text-[var(--panel-muted)]">
            A análise reúne os dados do seu restaurante e prioriza mudanças com impacto nas vendas. Cada oportunidade traz evidências e propostas para você revisar.
          </p>}
          <div className="mt-5 flex flex-wrap gap-4 border-t border-[var(--panel-border)] pt-4 text-xs text-[var(--panel-muted)]">
            <span className="flex items-center gap-1.5"><Target size={14} aria-hidden="true" />{report ? opportunities.length + " oportunidades priorizadas" : "Prioridades com evidências"}</span>
            <span className="flex items-center gap-1.5"><Check size={14} aria-hidden="true" />{report ? pending.length + " propostas para revisar" : "Você aprova cada mudança"}</span>
          </div>
      </section>}

      {!legacy && <section aria-label="Oportunidades prioritárias" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3>Oportunidades prioritárias</h3><p className="mt-1 text-xs text-[var(--panel-muted)]">Comece pelas mudanças com maior impacto e menor esforço.</p></div>
          {pending.length > 1 && <Button variant="secondary" disabled={disabled} onClick={() => onBatch(pending)}>Revisar e aplicar todos ({pending.length})</Button>}
        </div>
        {!opportunities.length && <div className={surface + " flex flex-col items-center px-5 py-8 text-center"}>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[10px] bg-[var(--panel-tint)] text-[var(--panel-accent-text)]"><Target size={24} aria-hidden="true" /></div>
          <h4 className="text-base font-medium">{waiting ? "Avaliando as melhores oportunidades" : report ? "Nenhuma oportunidade priorizada" : "Sua análise estará disponível aqui"}</h4>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--panel-muted)]">
            {waiting ? "O relatório aparecerá aqui assim que a análise terminar." : report ? (report.status === "partial" ? "A priorização ainda não foi concluída. Veja as propostas preservadas nos pontos para revisão." : "Não encontramos mudanças de alto impacto sustentadas pelos dados atuais.") : "As oportunidades aparecerão aqui quando seu relatório estiver disponível."}
          </p>
        </div>}
        {opportunities.map((o, i) => <article key={o.id} className={surface + " p-5 " + (activeOpportunityId === o.id ? "!border-[var(--panel-action)]" : "")}>
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--panel-tint)] text-sm font-medium text-[var(--panel-accent-text)]">{i + 1}</span>
            <div className="min-w-0 flex-1"><h4 className="text-base font-semibold">{o.title}</h4><p className="mt-2 text-sm leading-6 text-[var(--panel-muted)]">{o.explanation}</p></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--panel-muted)]">
            <span className={"rounded-full px-2.5 py-1 " + (o.impact === "high" ? "bg-[var(--panel-tint)] text-[var(--panel-accent-text)]" : "bg-[var(--panel-soft)]")}>Impacto {levels[o.impact]}</span>
            <span className="rounded-full bg-[var(--panel-soft)] px-2.5 py-1">Confiança {confidenceLevels[o.confidence]}</span>
            <span className="rounded-full bg-[var(--panel-soft)] px-2.5 py-1">Esforço {levels[o.effort]}</span>
            <span className="rounded-full bg-[var(--panel-soft)] px-2.5 py-1">Risco {levels[o.risk]}</span>
          </div>
          {renderActions(o)}{renderEvidence(o)}
          <div className="mt-4 flex justify-end border-t border-[var(--panel-border)] pt-4"><Button variant="secondary" disabled={disabled} aria-pressed={activeOpportunityId === o.id} onClick={() => onDiscuss(o)}><MessageSquare size={15} className="mr-2" />Conversar sobre isso</Button></div>
        </article>)}
      </section>}

      {!legacy && <section aria-label="Potencial e resultados" className="space-y-4">
        <div><h3>Comparações e resultados</h3><p className="mt-1 text-xs text-[var(--panel-muted)]">Contexto para decidir e acompanhar o que mudou.</p></div>
        <div className="grid gap-4 2xl:grid-cols-2">
          <div className={surface + " min-w-0 p-5 [&>details]:!m-0 [&>details]:!border-0 [&>details]:!p-0"}>
            {report ? <DataCard card={{...report.benchmark_snapshot, reason: report.benchmark_snapshot?.reason || "Ainda não há dados suficientes para uma comparação útil.", type:"benchmark"}} expanded /> : <>
              <div className="mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-[var(--panel-muted)]" /><h4 className="text-sm font-medium">Restaurantes semelhantes</h4></div>
              <p className="text-sm leading-6 text-[var(--panel-muted)]">Compare suas vendas com restaurantes parecidos quando houver dados suficientes.</p>
            </>}
          </div>
          <div className={surface + " min-w-0 p-5 [&>details]:!m-0 [&>details]:!border-0 [&>details]:!p-0"}>
            {report?.measurement_snapshot?.results?.length ? <DataCard card={{...report.measurement_snapshot, type:"measurement"}} expanded /> : <>
              <div className="mb-3 flex items-center gap-2"><ClipboardList size={16} className="text-[var(--panel-muted)]" /><h4 className="text-sm font-medium">Resultados das mudanças</h4></div>
              <p className="text-sm leading-6 text-[var(--panel-muted)]">{report?.measurement_snapshot?.reason || "Após aplicar mudanças, acompanhe aqui a comparação dos resultados antes e depois."}</p>
            </>}
          </div>
        </div>
      </section>}
      {!!reviewItems.length && <details className={surface + " p-5"}>
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><CircleHelp size={16} className="text-[var(--panel-muted)]" />Pontos para revisão ({reviewItems.length})</summary>
        <p className="mt-3 text-xs text-[var(--panel-muted)]">Decisões e configurações que precisam da sua atenção.</p>
        <div className="mt-4 space-y-5">{reviewItems.map((o) => <article key={o.id} className="border-t border-[var(--panel-border)] pt-4">
          <h4 className="text-sm font-medium">{o.title}</h4><p className="mt-2 text-sm leading-6 text-[var(--panel-muted)]">{o.explanation}</p>
          {renderActions(o)}{renderEvidence(o)}
          <Button variant="secondary" className="mt-3" disabled={disabled} onClick={() => onDiscuss(o)}><MessageSquare size={15} className="mr-2" />Conversar sobre isso</Button>
        </article>)}</div>
      </details>}
      {!legacy && <section aria-label="Potencial estimado" className={surface + " overflow-hidden !bg-[var(--panel-tint)] p-5 [&>div]:!m-0 [&>div]:!border-0 [&>div]:!bg-transparent [&>div]:!p-0"}>
        <h3 className="mb-4 flex items-center gap-2"><TrendingUp size={16} aria-hidden="true" />{Number(report?.potential_estimate?.days) === 7
          ? "O que seu restaurante pode ganhar na próxima semana com essas mudanças"
          : "O que seu restaurante pode ganhar com essas mudanças"}</h3>
        {report ? <DataCard card={{...report.potential_estimate, type: "potential"}} /> : <>
          <p className="text-2xl font-semibold text-[var(--panel-text)]">{waiting ? "Calculando…" : "A descobrir"}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--panel-muted)]">Uma estimativa conjunta baseada nas oportunidades e nos pedidos do seu restaurante.</p>
        </>}
      </section>}
      {report?.period?.start && <p className="text-xs text-[var(--panel-muted)]">Período analisado: {new Date(report.period.start).toLocaleDateString("pt-BR")} a {new Date(report.period.end).toLocaleDateString("pt-BR")}.</p>}
      {legacy && <section className={surface + " space-y-4 p-5"}>
        <p className="text-xs text-[var(--panel-muted)]">Relatório anterior ao formato estruturado.</p>
        <SalesMarkdown content={String(selected.result.reply || "").replace(/\[\[(?:action:[^\]]+|card:[^\]]+)\]\]/g, "")} />
        {actions.filter((a) => a.run_id === selected.id).map((a) => <ActionCard key={a.id} action={a} refs={refs} disabled={disabled} onAction={onAction} />)}
      </section>}
    </div>
  );
}

