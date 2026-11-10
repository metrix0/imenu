"use client";
import {useCallback,useState} from "react";
import dynamic from "next/dynamic";
import DevPage from "@/components/dev/DevPage";
import AnalyticsSection from "@/components/dev/AnalyticsSection";
const TrafficSourcesSection = dynamic(() => import("@/components/dev/TrafficSourcesSection"), {ssr:false});
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
        {loadedRange===rangeKey&&<>
            <SectionDivider title="Tráfego"/>
            <TrafficSourcesSection range={range}/>
            <SectionDivider title="Conversão"/>
            <PlusFunnelSection range={range} onDataLoaded={onFunnelLoaded}/>
        </>}
    </DevPage>;
}

function SectionDivider({title}:{title:string}){
    return <div className="flex min-w-0 items-center gap-4 pt-2">
        <h2 className="shrink-0 text-base font-semibold text-gray-900">{title}</h2>
        <hr className="min-w-0 flex-1 border-0 border-t border-[#e2e5e9]"/>
    </div>;
}
