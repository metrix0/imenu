"use client";

import { Search } from "lucide-react";
import Input from "@/components/ui/Input";
import Dropdown from "@/components/ui/Dropdown";
import DateRangePicker from "@/components/ui/DateRangePicker";
import type { DateRange } from "@/lib/utils/dateRange";

interface OrdersFilterProps {
    search: string;
    onSearchChange: (value: string) => void;
    range: DateRange;
    onRangeChange: (range: DateRange) => void;
    selectedStatus: string;
    onStatusChange: (value: string) => void;
}

export default function OrdersFilter({ search, onSearchChange, range, onRangeChange, selectedStatus, onStatusChange }: OrdersFilterProps) {
    return <div className="panel-history-filters">
        <Input label="Buscar pedido" placeholder="Número, cliente ou endereço" icon={<Search size={16} />} value={search} onChange={event => onSearchChange(event.target.value)} />
        <Dropdown label="Situação" value={selectedStatus} onChange={event => onStatusChange(event.target.value)} options={[
            { value: "todas", label: "Todas as situações" },
            { value: "pending_online_payment", label: "À Pagar" },
            { value: "pending_physical_payment", label: "Pendente (Pgt. Entrega)" },
            { value: "paid", label: "Pendente (Pago)" },
            { value: "preparing", label: "Preparando" },
            { value: "delivering", label: "Em Rota" },
            { value: "done", label: "Concluído" },
            { value: "canceled", label: "Cancelado" },
        ]} />
        <DateRangePicker value={range} onChange={onRangeChange} allowClear />
    </div>;
}
