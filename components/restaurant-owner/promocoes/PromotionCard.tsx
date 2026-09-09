import type { ReactNode } from "react";
import Card from "@/components/ui/Card";
import Switch from "@/components/ui/Switch";

export default function PromotionCard({ title, description, active, onToggle, disabled = false, children, actions }: {
    title: string;
    description: ReactNode;
    active: boolean;
    onToggle: () => void;
    disabled?: boolean;
    children?: ReactNode;
    actions: ReactNode;
}) {
    return <Card className="!p-4 sm:!p-5">
        <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 break-words">
                <h3>{title}</h3>
                <p className="mt-1 text-sm text-gray-600">{description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-1">
                <span className="text-xs text-gray-500">{active ? "Ativa" : "Pausada"}</span>
                <Switch checked={active} disabled={disabled} aria-label={`Ativar ${title}`} onClick={onToggle} />
            </div>
        </div>
        {children && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-500">{children}</div>}
        <fieldset disabled={disabled} className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 pt-3">{actions}</fieldset>
    </Card>;
}
