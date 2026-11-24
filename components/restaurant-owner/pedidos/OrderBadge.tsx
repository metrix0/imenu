import type { ComponentProps } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faCalendarDays, faChair, faClock } from "@fortawesome/free-solid-svg-icons";
import Badge, { type BadgeVariant } from "@/components/ui/Badge";
import { PanelIcon } from "@/components/ui/PanelIcon";
import type { OrderStatus } from "../OrderCard";

type BadgePresentation = {
    variant: BadgeVariant;
    label?: string;
    icon?: IconDefinition;
};

const presets = {
    pending: { variant: "warning", label: "Pendente" },
    preparing: { variant: "info", label: "Preparando" },
    inTransit: { variant: "purple", label: "Em Rota" },
    ready: { variant: "success", label: "Pronto" },
    completed: { variant: "success", label: "Concluído" },
    canceled: { variant: "danger", label: "Cancelado" },
    payment: { variant: "neutral" },
    ifood: { variant: "danger", label: "iFood" },
    paymentConfirmed: { variant: "success" },
    table: { variant: "brand", icon: faChair },
    count: { variant: "neutral" },
    scheduled: { variant: "success", icon: faCalendarDays },
    elapsed: { variant: "danger", icon: faClock },
} satisfies Record<string, BadgePresentation>;

const statusPresets = {
    pending_online_payment: "pending",
    pending_physical_payment: "pending",
    paid: "pending",
    preparing: "preparing",
    delivering: "inTransit",
    done: "completed",
    canceled: "canceled",
} satisfies Record<OrderStatus, keyof typeof presets>;

type BadgeKind = "ifood" | "payment" | "paymentConfirmed" | "table" | "count" | "scheduled" | "elapsed";

type OrderBadgeProps = Omit<ComponentProps<typeof Badge>, "variant" | "preset"> & (
    | { status: OrderStatus; readyOnSite?: boolean; kind?: never }
    | { kind: BadgeKind; status?: never; readyOnSite?: never }
);

export default function OrderBadge({ status, readyOnSite, kind, children, className, ...props }: OrderBadgeProps) {
    const statusPreset = status === "delivering" && readyOnSite ? "ready" : status && statusPresets[status];
    const { variant, label, icon }: BadgePresentation = presets[kind ?? statusPreset ?? "payment"];

    return (
        <Badge {...props} variant={variant} className={icon ? `gap-1.5 ${className ?? ""}` : className}>
            {icon && <PanelIcon icon={icon} aria-hidden="true" />}
            {children ?? label ?? status}
        </Badge>
    );
}
