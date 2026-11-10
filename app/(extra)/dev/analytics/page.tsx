"use client";
import {useCallback,useEffect,useState} from "react";
import dynamic from "next/dynamic";
import DevPage from "@/components/dev/DevPage";
import AnalyticsSection from "@/components/dev/AnalyticsSection";
const TrafficSourcesSection = dynamic(() => import("@/components/dev/TrafficSourcesSection"), {ssr:false});
const ImenuFunnelSection = dynamic(() => import("@/components/dev/ImenuFunnelSection"), {ssr:false});
const PlusFunnelSection = dynamic(() => import("@/components/dev/PlusFunnelSection"), {ssr:false});
import ShortcutDatePicker from "@/components/ui/ShortcutDatePicker";
import {getDateRangeForDays,type DateRange} from "@/lib/utils/dateRange";
import type {PlusExposureBreakdown} from "@/components/dev/DashboardPresentation";
export default function Page(){
    const [range,setRange]=useState(()=>getDateRangeForDays(7));
    const [loadedRange,setLoadedRange]=useState<string|null>(null);
    const [deferredRange,setDeferredRange]=useState<string|null>(null);
    const [breakdown,setBreakdown]=useState<{rangeKey:string;data:PlusExposureBreakdown}|null>(null);
    const rangeKey=range.startDate+"|"+range.endDate;
    const onMainLoaded=useCallback(()=>setLoadedRange(rangeKey),[rangeKey]);
    const onFunnelLoaded=useCallback((data:PlusExposureBreakdown)=>setBreakdown({rangeKey,data}),[rangeKey]);
    const onRangeChange=useCallback((next:DateRange)=>{
        setLoadedRange(null);
        setDeferredRange(null);
        setRange(next);
    },[]);

    // Mount all sections below Tráfego only after the top analytics has painted,
    // giving its chart rendering and first request priority over lower queries.
    useEffect(()=>{
        if(loadedRange!==rangeKey)return;
        const activate=()=>setDeferredRange(rangeKey);
        if("requestIdleCallback" in window){
            const id=window.requestIdleCallback(activate,{timeout:1500});
            return ()=>window.cancelIdleCallback(id);
        }
        const id=window.setTimeout(activate,0);
        return ()=>window.clearTimeout(id);
    },[loadedRange,rangeKey]);

    return <DevPage title="Analytics" actions={<ShortcutDatePicker value={range} onChange={onRangeChange}/>}>
        <AnalyticsSection range={range} onLoaded={onMainLoaded}
            plusExposureData={breakdown?.rangeKey===rangeKey?breakdown.data:null}/>
        {deferredRange===rangeKey&&<>
            <SectionDivider title="Tráfego"/>
            <TrafficSourcesSection range={range}/>
            <SectionDivider title="Conversão"/>
            <ImenuFunnelSection range={range}/>
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
