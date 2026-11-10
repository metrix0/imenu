"use client";
import {useCallback,useState} from "react";
import dynamic from "next/dynamic";
import DevPage from "@/components/dev/DevPage";
import AnalyticsSection from "@/components/dev/AnalyticsSection";
const PlusFunnelSection = dynamic(() => import("@/components/dev/PlusFunnelSection"), {ssr:false});
import ShortcutDatePicker from "@/components/ui/ShortcutDatePicker";
import {getDateRangeForDays} from "@/lib/utils/dateRange";
export default function Page(){
    const [range,setRange]=useState(()=>getDateRangeForDays(7));
    const [loadedRange,setLoadedRange]=useState<string|null>(null);
    const rangeKey=range.startDate+"|"+range.endDate;
    const onMainLoaded=useCallback(()=>setLoadedRange(rangeKey),[rangeKey]);
    return <DevPage title="Analytics" actions={<ShortcutDatePicker value={range} onChange={setRange}/>}>
        <AnalyticsSection range={range} onLoaded={onMainLoaded}/>
        {loadedRange===rangeKey&&<PlusFunnelSection range={range}/>}
    </DevPage>;
}
