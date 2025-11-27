"use client";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

interface DateFilterBarProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
}

export default function DateFilterBar({ 
    startDate, 
    endDate, 
    onStartDateChange, 
    onEndDateChange 
}: DateFilterBarProps) {
    return (
        <Card className="flex flex-wrap items-end gap-4 p-5 mb-6 border-gray-200 shadow-sm">
            <div className="flex-1 min-w-[150px]">
                <Input
                    label="Data Inicial"
                    type="date"
                    value={startDate}
                    onChange={(e) => onStartDateChange(e.target.value)}
                />
            </div>
            <div className="flex-1 min-w-[150px]">
                <Input
                    label="Data Final"
                    type="date"
                    value={endDate}
                    onChange={(e) => onEndDateChange(e.target.value)}
                />
            </div>
        </Card>
    );
}