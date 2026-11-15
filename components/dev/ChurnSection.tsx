"use client";

import { useCallback, useState } from "react";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { PanelIcon } from "@/components/ui/PanelIcon";
import Tooltip from "@/components/ui/Tooltip";
import { CHURN_BLASTS } from "@/lib/dev/abandonedBlast";
import type { DateRange } from "@/lib/utils/dateRange";
import BlastAutomation from "./BlastAutomation";
import { CrmList } from "./CrmSection";
import styles from "./dashboard.module.css";

const cohorts = [
    { activity: "churned_plus", name: "Churned iMenu Plus", criteria: "Plus pago venceu no período sem renovação", detail: "O período pago terminou nas datas selecionadas. A conta não tinha outro Plus com acesso vigente ao fim do período." },
    { activity: "churned_imenu", name: "Churned iMenu users", criteria: "Completaram 14 dias sem pedidos no período", detail: "Contas sem Plus ativo que chegaram a 14 dias sem pedidos concluídos fora de mesa nas datas selecionadas. Precisam ter concluído pedidos em pelo menos dois dias dos 30 dias anteriores ao abandono." },
    { activity: "single_day", name: "Um único dia de pedidos (14d)", criteria: "Cadastro completo · pedidos em apenas 1 dia nos últimos 14 dias" },
    { activity: "not_activated", name: "Não ativados", criteria: "Cadastro concluído no período · nenhum pedido", detail: "O cadastro foi concluído nas datas selecionadas e há mais de 24 horas. Nenhuma loja da conta registrou um pedido." },
];
const countFormat = new Intl.NumberFormat("pt-BR");

export default function ChurnSection({ range }: { range: DateRange }) {
    const [totals, setTotals] = useState<Record<string, number>>({});
    const updateTotal = useCallback((key: string, total: number) => {
        setTotals(current => current[key] === total ? current : { ...current, [key]: total });
    }, []);
    const periodKey = range.startDate + "|" + range.endDate;

    return (
        <div className="min-w-0 max-w-full space-y-6 overflow-x-clip">
            <dl className={styles.metricStrip} aria-label="Indicadores de churn">
                {cohorts.map(({ activity, name, criteria, detail }) => {
                    const total = totals[activity === "single_day" ? activity : periodKey + "|" + activity];
                    return <div key={activity}>
                        <dt className="flex items-center gap-1">
                            {name}
                            {detail && (
                                <Tooltip text={detail} size="medium" showOnClick>
                                    <button type="button" aria-label={`Informações sobre ${name}`} className="inline-flex h-6 w-6 items-center justify-center text-gray-400 hover:text-brand">
                                        <PanelIcon icon={faCircleInfo} className="h-3.5 w-3.5" />
                                    </button>
                                </Tooltip>
                            )}
                        </dt>
                        <dd>{total === undefined ? "—" : countFormat.format(total)}</dd>
                        <p>{criteria}</p>
                    </div>
                })}
            </dl>
            {cohorts.map(({ activity, name }) => (
                <ChurnTable key={activity === "single_day" ? activity : periodKey + "|" + activity}
                    activity={activity} title={name} range={activity === "single_day" ? undefined : range}
                    onTotalChange={updateTotal} />
            ))}
            <BlastAutomation automations={CHURN_BLASTS} />
        </div>
    );
}

function ChurnTable({ activity, title, range, onTotalChange }: {
    activity: string;
    title: string;
    range?: DateRange;
    onTotalChange: (key: string, total: number) => void;
}) {
    const reportTotal = useCallback((key: string, total: number) => {
        onTotalChange(range ? range.startDate + "|" + range.endDate + "|" + key : key, total);
    }, [range, onTotalChange]);
    return <CrmList activity={activity} title={title} range={range} showBlast onTotalChange={reportTotal} />;
}
