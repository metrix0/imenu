"use client";
import DateRangePicker from "./DateRangePicker";
import { DATE_FILTER_PRESETS, type DateRange, type DateFilterPreset } from "@/lib/utils/dateRange";
export default function ShortcutDatePicker({value,onChange,presets=DATE_FILTER_PRESETS,singleDate=false}:{value:DateRange;onChange:(range:DateRange)=>void;presets?:DateFilterPreset[];singleDate?:boolean}) {
 const selected=presets.find(p=>{const r=p.getRange();return r.startDate===value.startDate&&r.endDate===value.endDate;});
 return <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-[#e2e5e9] bg-white p-1">
 {presets.map(p=><button key={p.label} type="button" onClick={()=>onChange(p.getRange())} aria-pressed={selected===p} className={`cursor-pointer rounded-md px-3 py-2 text-xs ${selected===p?"bg-[#f1f3f5] font-semibold text-gray-900":"font-medium text-gray-500 hover:bg-gray-50"}`}>{p.label}</button>)}
 <DateRangePicker label={singleDate?"Data":"Período"} value={value} onChange={onChange} presets={[]} singleDate={singleDate} iconOnly active={!selected}/>
 </div>;
}
