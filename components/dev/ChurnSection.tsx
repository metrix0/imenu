"use client";

import { useCallback, useState } from "react";
import { CHURN_BLAST_AUTOMATIONS, CHURN_BLASTS } from "@/lib/dev/abandonedBlast";
import BlastAutomation from "./BlastAutomation";
import { CrmList } from "./CrmSection";
import styles from "./dashboard.module.css";

const cohorts = Object.entries(CHURN_BLAST_AUTOMATIONS);
const countFormat = new Intl.NumberFormat("pt-BR");

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
                        <dt>{name}</dt>
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
