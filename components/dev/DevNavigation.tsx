"use client";

import { useState, type ReactNode } from "react";
import { faChartLine, faBullhorn, faHeadset, faHeartPulse, faClipboardCheck, faHouse, faMoneyBillWave, faRightFromBracket, faUsers } from "@fortawesome/free-solid-svg-icons";
import PanelNavigation, { type PanelMenuItem } from "@/components/common/PanelNavigation";
import { supabase } from "@/lib/database/supabaseClient";

const sections: PanelMenuItem[] = [
    { label: "Dashboard", href: "/dev", icon: faHouse },
    { label: "Health", href: "/dev/health", icon: faHeartPulse },
    { label: "CRM", href: "/dev/crm", icon: faUsers },
    { label: "Blast", href: "/dev/blast", icon: faBullhorn },
    { label: "Payouts", href: "/dev/payouts", icon: faMoneyBillWave },
    { label: "Support", href: "/dev/support", icon: faHeadset },
    { label: "Analytics", href: "/dev/analytics", icon: faChartLine },
    { label: "Quality Assurance", href: "/dev/quality-assurance", icon: faClipboardCheck },
];

export default function DevNavigation({ children }: { children: ReactNode }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function signOut() {
        setBusy(true);
        try {
            const { error } = await supabase.auth.signOut({ scope: "local" });
            if (error) setError("Não foi possível sair.");
        } catch { setError("Não foi possível sair."); }
        finally { setBusy(false); }
    }
    return <PanelNavigation base="/dev" menuItems={sections} contentAs="div"
        footerAction={{ label: busy ? "Saindo…" : "Sair da conta", icon: faRightFromBracket, disabled: busy, error, onClick: () => void signOut() }}>
        {children}
    </PanelNavigation>;
}
