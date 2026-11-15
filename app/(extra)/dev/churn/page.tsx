"use client";

import { useState } from "react";
import ChurnSection from "@/components/dev/ChurnSection";
import DevPage from "@/components/dev/DevPage";
import ShortcutDatePicker from "@/components/ui/ShortcutDatePicker";
import { getDateRangeForDays } from "@/lib/utils/dateRange";

export default function Page() {
    const [range, setRange] = useState(() => getDateRangeForDays(7));
    return (
        <DevPage title="Churn" actions={<ShortcutDatePicker value={range} onChange={setRange} />}>
            <ChurnSection range={range} />
        </DevPage>
    );
}
