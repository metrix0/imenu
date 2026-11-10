"use client";
import {useCallback,useState} from "react";
import dynamic from "next/dynamic";
import DevPage from "@/components/dev/DevPage";
import AnalyticsSection from "@/components/dev/AnalyticsSection";
const PlusFunnelSection = dynamic(() => import("@/components/dev/PlusFunnelSection"), {ssr:false});
import ShortcutDatePicker from "@/components/ui/ShortcutDatePicker";
import {getDateRangeForDays} from "@/lib/utils/dateRange";
import type {PlusExposureBreakdown} from "@/components/dev/DashboardPresentation";
export default function Page(){
    const [range,setRange]=useState(()=>getDateRangeForDays(7));
    const [loadedRange,setLoadedRange]=useState<string|null>(null);
    const [breakdown,setBreakdown]=useState<{rangeKey:string;data:PlusExposureBreakdown}|null>(null);
    const rangeKey=range.startDate+"|"+range.endDate;
    const onMainLoaded=useCallback(()=>setLoadedRange(rangeKey),[rangeKey]);
    const onFunnelLoaded=useCallback((data:PlusExposureBreakdown)=>setBreakdown({rangeKey,data}),[rangeKey]);
    return <DevPage title="Analytics" actions={<ShortcutDatePicker value={range} onChange={setRange}/>}>
        <AnalyticsSection range={range} onLoaded={onMainLoaded}
            plusExposureData={breakdown?.rangeKey===rangeKey?breakdown.data:null}/>
        {loadedRange===rangeKey&&<PlusFunnelSection range={range} onDataLoaded={onFunnelLoaded}/>}
    </DevPage>;
}
