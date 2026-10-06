"use client";
import { useLayoutEffect, useRef } from "react";
import Image from "next/image";
import { ChevronDown, CircleHelp, ClipboardList, History, MessageSquare, Rocket, Sparkles, Target } from "lucide-react";
import Tooltip from "@/components/ui/Tooltip";
import { IA_PLUS_FEATURE_MESSAGE, IA_PLUS_PRICE_LABEL } from "@/lib/addons/products";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
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
  analyses, selected, actions, refs, disabled, loading, generating, locked = false, onUpgrade,
  activeOpportunityId, onSelect, onDiscuss, onChat, onHistory, onAction, onBatch,
}: {
  locked?: boolean; onUpgrade?: () => void;
  analyses: Data[]; selected?: Data; actions: Action[]; refs: Record<string, string>;
  disabled: boolean; loading: boolean; generating: boolean;
  activeOpportunityId?: string;
  onSelect: (id: string) => void; onDiscuss: (item: Data) => void; onChat: () => void;
  onHistory: () => void; onAction: (command: string, ids: string[]) => void; onBatch: (ids: string[]) => void;
}) {
  const report = selected?.result?.report, legacy = selected && !report;
  const paperRef = useRef<HTMLDivElement>(null);
  const structuredContentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const paper = paperRef.current;
    const content = structuredContentRef.current;
    if (!locked || !report || legacy || !paper || !content) return;

    const update = () => {
      const cutoff = Math.round(content.scrollHeight * 0.75);
      paper.style.setProperty("--locked-cutoff", `${cutoff}px`);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(content);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      paper.style.removeProperty("--locked-cutoff");
    };
  }, [locked, report, legacy]);

  if (loading) {
    return <div className={styles.loading} role="status" aria-label="Carregando"><Loader /></div>;
  }
  const opportunities: Data[] = report?.opportunities || [], reviewItems: Data[] = report?.review_items || [];
  const actionById = new Map(actions.map((action) => [action.id, action]));
  const withGenerated = (ids: string[] = []) => [...new Set(ids.flatMap((id) => [id, ...(actionById.get(id)?.generated_actions || [])]))];
  const ids: string[] = report ? [...opportunities, ...reviewItems].flatMap((o) => o.action_ids || [])
    : actions.filter((a) => a.run_id === selected?.id).map((a) => a.id);
  const pending = withGenerated(ids).filter((id) => actionById.get(id)?.status === "pending");
  const gate = (content: React.ReactNode) => locked ? <div data-ia-plus-action><Tooltip text={IA_PLUS_FEATURE_MESSAGE} parentClassName="!block">{content}</Tooltip></div> : content;

  if (!selected) {
    return (
      <div className={styles.report}>
        <header className="panel-page-heading mb-8">
          <h1 className="text-3xl font-bold text-gray-900 2xl:text-4xl">Análise de vendas</h1>
          <p className="mt-1 text-gray-500 2xl:mt-2 2xl:text-lg">Encontre oportunidades para vender e aplique automaticamente com IA.</p>
        </header>

        {locked ? (
          <section className={styles.noAnalysisState}>
            <div className={styles.stateIcon}><Sparkles size={24} aria-hidden="true" /></div>
            <div className={styles.noAnalysisIntro}>
              <h2>Sua análise ainda não foi liberada</h2>
              <p>A Análise de vendas usa os dados reais do seu restaurante para encontrar oportunidades que podem aumentar suas vendas e transformar os melhores achados em mudanças prontas para revisão.</p>
            </div>

            <div className={styles.analysisSteps} aria-label="Como funciona a análise">
              <article>
                <span><Rocket size={18} aria-hidden="true" /></span>
                <div>
                  <strong>Aplica melhorias automaticamente</strong>
                  <p>Você apenas revisa e aceita as mudanças que aumentam seu faturamento.</p>
                </div>
              </article>
              <article>
                <span><ClipboardList size={18} aria-hidden="true" /></span>
                <div>
                  <strong>Entende suas vendas</strong>
                  <p>Analisa pedidos, desempenho dos produtos, cardápio e configurações do restaurante.</p>
                </div>
              </article>
              <article>
                <span><Target size={18} aria-hidden="true" /></span>
                <div>
                  <strong>Encontra o que vale priorizar</strong>
                  <p>Destaca oportunidades com evidências e, quando possível, estima o impacto nas próximas 4 semanas.</p>
                </div>
              </article>
            </div>

            <div className={styles.freeReleaseNote}>
              <strong>Como funciona o acesso gratuito</strong>
              <p>Por enquanto, estamos liberando análises gratuitas para poucos restaurantes por vez. Quando o seu for selecionado, a análise aparecerá automaticamente aqui. Volte em outro dia para conferir. Aplicar as modificações da análise automaticamente é uma função do Plano IA Plus.</p>
            </div>

            <div className={styles.upgradeState}>
              <div className={styles.upgradeMain}>
                <div className={styles.upgradeLogo}>
                  <Image
                    src="/logos/IAPlusCombinationMarkLogo_Brand.png"
                    alt="iMenu IA Plus"
                    fill
                    sizes="180px"
                    className="object-contain object-left"
                  />
                </div>
                <div>
                  <span className={styles.upgradeEyebrow}>Sem esperar pela seleção gratuita</span>
                  <h3>Comece sua análise agora</h3>
                  <p>Com o iMenu IA Plus, sua análise começa automaticamente, sem esperar pela seleção gratuita. A análise profunda pode levar até 1 hora para ser concluída após ativar o plano.</p>
                </div>
                <ul className={styles.upgradeBenefits}>
                  <li>Análise iniciada automaticamente</li>
                  <li>Acesso completo às oportunidades encontradas</li>
                  <li>Converse com a IA e revise e aplique as mudanças sugeridas</li>
                </ul>
              </div>
              <div className={styles.upgradeAction}>
                <p><strong>{IA_PLUS_PRICE_LABEL}</strong><span>/mês</span></p>
                <Button onClick={onUpgrade}>Começar análise agora</Button>
                <small>Cartão ou Pix · cancele quando quiser</small>
              </div>
            </div>
          </section>
        ) : (
          <section className={styles.noAnalysisState} role="status" aria-live="polite" aria-busy={generating}>
            <div className={styles.preparingIcon}><Loader /></div>
            <h2>Preparando sua análise</h2>
            <p>A IA está analisando seus pedidos, cardápio e oportunidades de venda. A análise profunda pode levar até 1 hora para ser concluída após ativar o plano. Seu relatório aparecerá aqui assim que estiver pronto.</p>
          </section>
        )}
      </div>
    );
  }

  const renderActions = (entry: Data) => {
    const entryIds = [...new Set<string>(entry.action_ids || [])],
      nestedGenerated = new Set(
        entryIds.flatMap((id) => actionById.get(id)?.generated_actions || []),
      );
    return entryIds
      .filter((id) => !nestedGenerated.has(id))
      .map((id) => {
        const action = actionById.get(id);
        if (!action) return null;
        const generatedActions = (action.generated_actions || [])
          .map((generatedId) => actionById.get(generatedId))
          .filter((generated): generated is Action => !!generated);
        return (
          <div key={id}>{gate(<ActionCard
            key={id}
            action={action}
            generatedActions={generatedActions}
            refs={refs}
            disabled={disabled}
            onAction={onAction}
            compact
          />)}</div>
        );
      });
  };
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
  const discuss = (entry: Data) => gate(<button type="button" className={styles.discuss} disabled={!locked && disabled}
    aria-pressed={activeOpportunityId === entry.id} onClick={() => onDiscuss(entry)}>
    <MessageSquare size={14} aria-hidden="true" />Conversar sobre isso
  </button>);

  return (
    <div className={`${styles.report} ${locked ? styles.reportLocked : ""}`} onClickCapture={locked ? event => { if ((event.target as HTMLElement).closest("[data-ia-plus-action] button")) { event.preventDefault(); event.stopPropagation(); onUpgrade?.(); } } : undefined}>
      <header className="panel-page-heading flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 2xl:text-4xl">Análise de vendas</h1>
          <p className="text-gray-500 mt-1 2xl:text-lg 2xl:mt-2">Encontre oportunidades para vender e aplique automaticamente com IA.</p>
        </div>
        <div className="panel-page-actions flex flex-row items-center gap-2 sm:gap-3">
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

      {report?.status === "partial" && !generating && <div role="status" className={styles.notice}>
        <CircleHelp size={18} aria-hidden="true" /><p>Esta análise não foi concluída. As propostas preparadas estão disponíveis para revisão.</p>
      </div>}

      <div ref={paperRef} className={`${styles.paper} ${locked && report && !legacy ? styles.paperLocked : ""}`}>
        {!legacy && <>
          <div ref={structuredContentRef} className={styles.structuredContent}>
          <section aria-label="Potencial estimado" className={styles.hero}>
            <div>
              <h2>O que seu restaurante pode ganhar em 4 semanas</h2>
              {report ? <DataCard card={{ ...report.potential_estimate, hide_period_label: true, type: "potential" }} presentation="report" /> : <div className={styles.potential}>
                <p className={styles.gain}>A descobrir</p>
                <p className={styles.comparisonNote}>Uma estimativa baseada nas oportunidades e nos pedidos do seu restaurante.</p>
              </div>}
            </div>
            <div className={styles.heroActions}>
              {gate(<Button disabled={!locked && (disabled || !pending.length)} onClick={() => onBatch(pending)}>Revisar e aplicar tudo</Button>)}
              {gate(<Button variant="secondary" disabled={!locked && disabled} onClick={onChat}><MessageSquare size={15} aria-hidden="true" />Conversar com Assistente de IA</Button>)}
              <p className={styles.approvalNote}>Você revisa cada mudança antes de confirmar.</p>
            </div>
          </section>

          <section aria-label="Resumo da IA" className={styles.summary}>
            <p className={styles.eyebrow}><Sparkles size={14} aria-hidden="true" />Resumo da IA</p>
            <div className={styles.summaryCopy}>{report ? <SalesMarkdown content={report.summary} /> : <p>A análise prioriza melhorias nas vendas e traz mudanças prontas para você revisar.</p>}</div>
          </section>

          <section aria-label="Prioridades" className={styles.opportunitiesCard}>
            <div className={styles.sectionHeader}><h2>Prioridades</h2>{!!opportunities.length && <span className={styles.count}>{report?.opportunity_count ?? opportunities.length}</span>}</div>
            {!opportunities.length && <div className={styles.empty}>
              <Target size={28} aria-hidden="true" />
              <h3>{report ? "Nenhuma oportunidade priorizada" : "Sua análise estará disponível aqui"}</h3>
              <p>{report ? (report.status === "partial" ? "A priorização ainda não foi concluída. Veja as propostas preservadas nos pontos para revisão." : "Não encontramos mudanças de alto impacto sustentadas pelos dados atuais.") : "As oportunidades aparecerão aqui quando seu relatório estiver disponível."}</p>
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
            <section aria-label={SHOW_MEASUREMENT_HISTORY ? "Comparações e resultados" : "Comparações"} className={styles.comparison}>
              <DataCard card={{ ...report?.benchmark_snapshot, reason: report?.benchmark_snapshot?.reason || "Ainda não há dados suficientes para uma comparação útil.", current: report?.sales_snapshot, type: "benchmark" }} presentation="report" />
              {SHOW_MEASUREMENT_HISTORY && <div className="mt-6">
                {report?.measurement_snapshot?.results?.some((r: Data) => r.before.orders || r.after.orders) ? <DataCard card={{ ...report.measurement_snapshot, type: "measurement" }} expanded /> : <>
                  <h3><ClipboardList size={16} />Resultados das mudanças</h3>
                  <p className={styles.comparisonNote}>{report?.measurement_snapshot?.reason || report?.measurement_snapshot?.note || "Ainda não há vendas suficientes após as mudanças para comparar os resultados."}</p>
                </>}
              </div>}
            </section>
            {!!reviewItems.length && <section aria-label="Pontos rápidos para revisão" className={styles.review}>
              <div className={styles.reviewSummary}>
                <h2>Pontos rápidos para revisão <span className={styles.count}>{reviewItems.length}</span></h2>
              </div>
              <div className={styles.reviewEntries}>{reviewItems.map((entry) => <article key={entry.id} className={styles.reviewEntry}>
                <div><h3>{entry.title}</h3><p className={styles.explanation}>{entry.explanation}</p><div className={styles.opportunityTools}>{renderEvidence(entry)}{discuss(entry)}</div></div>
                <div className={styles.proposalList}>{renderActions(entry)}</div>
              </article>)}</div>
            </section>}
          </div>
          </div>
          {locked && report && <div className={`${styles.paywall} ${styles.structuredPaywall}`}><div className={styles.paywallCard}><div className={`${styles.paywallImage} ${styles.paywallLogo}`}><Image src="/logos/IAPlusCombinationMarkLogo_Brand.png" alt="" fill sizes="200px" className="object-contain" /></div><h3>Coloque essas oportunidades em prática</h3><p>Veja a análise completa, converse com a IA e revise e aplique as melhorias com o iMenu IA Plus.</p><Button onClick={onUpgrade}>Conhecer iMenu IA Plus</Button></div></div>}
        </>}
        {legacy && <div className={locked ? styles.preview : undefined}><div className={locked ? styles.previewContent : undefined}><section className={styles.legacy}>
          <p className={styles.eyebrow}>Relatório anterior ao formato estruturado.</p>
          <SalesMarkdown content={String(selected.result.reply || "").replace(/\[\[(?:action:[^\]]+|card:[^\]]+)\]\]/g, "")} />
          {actions.filter((action) => action.run_id === selected.id).map((action) => <ActionCard key={action.id} action={action} generatedActions={(action.generated_actions || []).map((id) => actionById.get(id)).filter((generated): generated is Action => !!generated)} refs={refs} disabled={disabled} onAction={onAction} />)}
        </section></div>{locked && <div className={styles.paywall}><div className={styles.paywallImage}><Image src="/images/IAPlus.png" alt="" fill sizes="80px" className="object-contain" /></div><h3>Veja a análise completa</h3><p>Converse com a IA e revise e aplique as melhorias com o iMenu IA Plus.</p><Button onClick={onUpgrade}>Conhecer iMenu IA Plus</Button></div>}</div>}
      </div>
    </div>
  );
}
