"use client";
import {useState} from "react";
import DevPage from "@/components/dev/DevPage";
import AnalyticsSection from "@/components/dev/AnalyticsSection";
import PlusFunnelSection from "@/components/dev/PlusFunnelSection";
import ShortcutDatePicker from "@/components/ui/ShortcutDatePicker";
import {getDateRangeForDays} from "@/lib/utils/dateRange";
export default function Page(){const [range,setRange]=useState(()=>getDateRangeForDays(7));return <DevPage title="Analytics" actions={<ShortcutDatePicker value={range} onChange={setRange}/>}><AnalyticsSection range={range}/><PlusFunnelSection range={range}/></DevPage>;}
