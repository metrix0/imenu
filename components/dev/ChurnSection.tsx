"use client";

import { useCallback, useState } from "react";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { PanelIcon } from "@/components/ui/PanelIcon";
import Tooltip from "@/components/ui/Tooltip";
import { CHURN_BLAST_AUTOMATIONS, CHURN_BLASTS } from "@/lib/dev/abandonedBlast";
import BlastAutomation from "./BlastAutomation";
import { CrmList } from "./CrmSection";
import styles from "./dashboard.module.css";

const cohorts = Object.entries(CHURN_BLAST_AUTOMATIONS);
const countFormat = new Intl.NumberFormat("pt-BR");
const cohortDetails: Partial<Record<string, string>> = {
    abandoned_plus: "Contagem diária. Com Plus ativo, a conta passou de 14 dias sem pedidos concluídos fora de mesa entre ontem às 19h e hoje às 19h. Teve pedidos desse tipo em pelo menos dois dias nos 30 dias anteriores ao corte.",
    abandoned_imenu: "Contagem diária. Sem Plus ativo, a conta passou de 14 dias sem pedidos concluídos fora de mesa entre ontem às 19h e hoje às 19h. Teve pedidos desse tipo em pelo menos dois dias nos 30 dias anteriores ao corte.",
    no_first_order: "No corte de hoje às 19h, a conta concluiu o cadastro há mais de 24 horas e até 48 horas. Nenhuma loja da conta registrou um pedido.",
};

export default function ChurnSection() {
    const [totals, setTotals] = useState<Record<string, number>>({});
    const updateTotal = useCallback((activity: string, total: number) => {
        setTotals(current => current[activity] === total ? current : { ...current, [activity]: total });
    }, []);

    return (
        <div className="min-w-0 max-w-full space-y-6 overflow-x-clip">
            <dl className={styles.metricStrip} aria-label="Indicadores de churn">
                {cohorts.map(([activity, { name, criteria }]) => (
                    <div key={activity}>
                        <dt className="flex items-center gap-1">
                            {name}
                            {cohortDetails[activity] && (
                                <Tooltip text={cohortDetails[activity]} size="medium" showOnClick>
                                    <button type="button" aria-label={`Informações sobre ${name}`} className="inline-flex h-6 w-6 items-center justify-center text-gray-400 hover:text-brand">
                                        <PanelIcon icon={faCircleInfo} className="h-3.5 w-3.5" />
                                    </button>
                                </Tooltip>
                            )}
                        </dt>
                        <dd>{totals[activity] === undefined ? "—" : countFormat.format(totals[activity])}</dd>
                        <p>{criteria}</p>
                    </div>
                ))}
            </dl>
            {cohorts.map(([activity, { name }]) => (
                <CrmList key={activity} activity={activity} title={name} onTotalChange={updateTotal} />
            ))}
            <BlastAutomation automations={CHURN_BLASTS} />
        </div>
    );
}
