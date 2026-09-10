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
        <div className="min-w-0 break-words">
            <h3>{title}</h3>
            <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
        {children && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-500">{children}</div>}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 sm:justify-start">
            <Switch checked={active} disabled={disabled} aria-label={`Ativar ${title}`} onClick={onToggle} />
            <fieldset disabled={disabled} className="flex flex-wrap items-center gap-2">{actions}</fieldset>
        </div>
    </Card>;
}
