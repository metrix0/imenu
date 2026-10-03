"use client";
import { ChevronDown, CircleHelp, ClipboardList, History, LoaderCircle, MessageSquare, Sparkles, Target } from "lucide-react";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import SalesMarkdown from "./SalesMarkdown";
import { ActionCard, DataCard } from "./SalesWidgets";
import type { Action, Data } from "@/lib/ia-vendas/types";
import styles from "./AnalysisReport.module.css";

const levels: Record<string, string> = { high: "alto", medium: "médio", low: "baixo" };
const confidenceLevels: Record<string, string> = { high: "alta", medium: "média", low: "baixa" };
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
  const actionById = new Map(actions.map((action) => [action.id, action]));
  const withGenerated = (ids: string[] = []) => [...new Set(ids.flatMap((id) => [id, ...(actionById.get(id)?.generated_actions || [])]))];
  const ids: string[] = report ? [...opportunities, ...reviewItems].flatMap((o) => o.action_ids || [])
    : actions.filter((a) => a.run_id === selected?.id).map((a) => a.id);
  const pending = withGenerated(ids).filter((id) => actionById.get(id)?.status === "pending");
  const renderActions = (entry: Data) => withGenerated(entry.action_ids).map((id) => {
    const action = actionById.get(id);
    return action ? <ActionCard key={id} action={action} refs={refs} disabled={disabled} onAction={onAction} compact /> : null;
  });
  const renderEvidence = (entry: Data, assessment = false) => entry.evidence?.length || assessment ? (
    <details className={styles.disclosure}>
      <summary>Ver evidências<ChevronDown size={13} aria-hidden="true" /></summary>
      <div className={styles.evidence}>
        {assessment && <dl className={styles.assessment}>
          <div><dt>Impacto esperado</dt><dd>{levels[entry.impact]}</dd></div>
          <div><dt>Confiança</dt><dd>{confidenceLevels[entry.confidence]}</dd></div>
          <div><dt>Esforço</dt><dd>{levels[entry.effort]}</dd></div>
          <div><dt>Risco</dt><dd>{levels[entry.risk]}</dd></div>
        </dl>}
        {!!entry.evidence?.length && <ul>{entry.evidence.map((e: Data, i: number) => <li key={i}>{e.detail}</li>)}</ul>}
      </div>
    </details>
  ) : null;
  const discuss = (entry: Data) => <button type="button" className={styles.discuss} disabled={disabled}
    aria-pressed={activeOpportunityId === entry.id} onClick={() => onDiscuss(entry)}>
    <MessageSquare size={14} aria-hidden="true" />Conversar sobre isso
  </button>;

  return (
    <div className={styles.report} aria-busy={waiting}>
      <header className={styles.pageHeader}>
        <div className={styles.pageTitle}><span className={styles.reportIcon}><Sparkles size={19} aria-hidden="true" /></span><h1>Análise de vendas</h1></div>
        <div className={styles.headerControls}>
          {analyses.length > 1 && <div className={styles.historySelect}>
            <Dropdown aria-label="Histórico de análises" value={selected?.id || ""} disabled={disabled}
              onChange={(e) => onSelect(e.target.value)} options={[
                { value: "", label: "Visão atual" },
                ...analyses.map((a, i) => ({ value: a.id,
                  label: (i === 0 ? "Mais recente · " : "") + new Date(a.created_at).toLocaleString("pt-BR") + (a.status !== "completed" ? " · Não concluída" : ""),
                })),
              ]} />
          </div>}
          <Button variant="secondary" aria-label="Histórico de ações" title="Histórico de ações" onClick={onHistory}><History size={16} /></Button>
        </div>
      </header>

      {waiting && <div role="status" className={styles.notice}>
        <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        <p>{status || (generating ? "Preparando seu relatório. As oportunidades aparecerão assim que a análise terminar." : "Carregando análise…")}</p>
      </div>}
      {report?.status === "partial" && !generating && <div role="status" className={styles.notice}>
        <CircleHelp size={18} aria-hidden="true" /><p>Esta análise não foi concluída. As propostas preparadas estão disponíveis para revisão.</p>
      </div>}

      <div className={styles.paper}>
        {!legacy && <>
          <section aria-label="Potencial estimado" className={styles.hero}>
            <div>
              <h2>O que seu restaurante pode ganhar em 4 semanas</h2>
              {report ? <DataCard card={{ ...report.potential_estimate, hide_period_label: true, type: "potential" }} presentation="report" /> : <div className={styles.potential}>
                <p className={styles.gain}>{waiting ? "Calculando…" : "A descobrir"}</p>
                <p className={styles.comparisonNote}>Uma estimativa baseada nas oportunidades e nos pedidos do seu restaurante.</p>
              </div>}
            </div>
            <div className={styles.heroActions}>
              <Button disabled={disabled || !pending.length} onClick={() => onBatch(pending)}>Revisar e aplicar tudo</Button>
              <Button variant="secondary" disabled={disabled} onClick={onChat}><MessageSquare size={15} aria-hidden="true" />Conversar com Assistente de IA</Button>
              <p className={styles.approvalNote}>Você revisa cada mudança antes de confirmar.</p>
            </div>
          </section>

          <section aria-label="Resumo da IA" className={styles.summary}>
            <p className={styles.eyebrow}><Sparkles size={14} aria-hidden="true" />Resumo da IA</p>
            <h2>{report?.headline || (waiting ? "Encontrando oportunidades para vender mais" : "Seu próximo passo para vender mais")}</h2>
            <div className={styles.summaryCopy}>{report ? <SalesMarkdown content={report.summary} /> : <p>A análise prioriza melhorias nas vendas e traz mudanças prontas para você revisar.</p>}</div>
          </section>

          <section aria-label="Oportunidades prioritárias">
            <div className={styles.sectionHeader}><h2>Oportunidades prioritárias</h2>{!!opportunities.length && <span className={styles.count}>{opportunities.length}</span>}</div>
            {!opportunities.length && <div className={styles.empty}>
              <Target size={28} aria-hidden="true" />
              <h3>{waiting ? "Avaliando as melhores oportunidades" : report ? "Nenhuma oportunidade priorizada" : "Sua análise estará disponível aqui"}</h3>
              <p>{waiting ? "O relatório aparecerá aqui assim que a análise terminar." : report ? (report.status === "partial" ? "A priorização ainda não foi concluída. Veja as propostas preservadas nos pontos para revisão." : "Não encontramos mudanças de alto impacto sustentadas pelos dados atuais.") : "As oportunidades aparecerão aqui quando seu relatório estiver disponível."}</p>
            </div>}
            {opportunities.map((entry, index) => <article key={entry.id} aria-label={entry.title}
              className={`${styles.opportunity} ${activeOpportunityId === entry.id ? styles.opportunityActive : ""}`}>
              <div className={styles.opportunityContent}>
                <div className={styles.opportunityHeading}><span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><h3>{entry.title}</h3></div>
                <p className={styles.explanation}>{entry.explanation}</p>
                <div className={styles.opportunityTools}>{renderEvidence(entry, true)}{discuss(entry)}</div>
              </div>
              <div className={styles.proposalList}>{renderActions(entry)}</div>
            </article>)}
          </section>

          <div className={styles.secondary}>
            {!!reviewItems.length && <details className={styles.review}>
              <summary className={styles.reviewSummary}>
                <CircleHelp size={20} aria-hidden="true" />
                <div><strong>Pontos para revisão <span className={styles.count}>{reviewItems.length}</span></strong><p>{reviewItems[0].title}</p></div>
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <div className={styles.reviewEntries}>{reviewItems.map((entry) => <article key={entry.id} className={styles.reviewEntry}>
                <div><h3>{entry.title}</h3><p className={styles.explanation}>{entry.explanation}</p><div className={styles.opportunityTools}>{renderEvidence(entry)}{discuss(entry)}</div></div>
                <div className={styles.proposalList}>{renderActions(entry)}</div>
              </article>)}</div>
            </details>}
            <section aria-label={SHOW_MEASUREMENT_HISTORY ? "Comparações e resultados" : "Comparações"} className={styles.comparison}>
              <DataCard card={{ ...report?.benchmark_snapshot, reason: report?.benchmark_snapshot?.reason || "Ainda não há dados suficientes para uma comparação útil.", type: "benchmark" }} presentation="report" />
              {SHOW_MEASUREMENT_HISTORY && <div className="mt-6">
                {report?.measurement_snapshot?.results?.some((r: Data) => r.before.orders || r.after.orders) ? <DataCard card={{ ...report.measurement_snapshot, type: "measurement" }} expanded /> : <>
                  <h3><ClipboardList size={16} />Resultados das mudanças</h3>
                  <p className={styles.comparisonNote}>{report?.measurement_snapshot?.reason || report?.measurement_snapshot?.note || "Ainda não há vendas suficientes após as mudanças para comparar os resultados."}</p>
                </>}
              </div>}
            </section>
          </div>
        </>}
        {legacy && <section className={styles.legacy}>
          <p className={styles.eyebrow}>Relatório anterior ao formato estruturado.</p>
          <SalesMarkdown content={String(selected.result.reply || "").replace(/\[\[(?:action:[^\]]+|card:[^\]]+)\]\]/g, "")} />
          {actions.filter((action) => action.run_id === selected.id).map((action) => <ActionCard key={action.id} action={action} refs={refs} disabled={disabled} onAction={onAction} />)}
        </section>}
      </div>
    </div>
  );
}
