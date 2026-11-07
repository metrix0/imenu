"use client";
import {useState} from "react";
import DevPage from "@/components/dev/DevPage";
import HealthSection from "@/components/dev/HealthSection";
import ShortcutDatePicker from "@/components/ui/ShortcutDatePicker";
import {getDateRangeForDays} from "@/lib/utils/dateRange";
export default function Page(){const [range,setRange]=useState(()=>getDateRangeForDays(1));return <DevPage title="Health" actions={<ShortcutDatePicker value={range} onChange={setRange}/>}><HealthSection range={range}/></DevPage>;}
