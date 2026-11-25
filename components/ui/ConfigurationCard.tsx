"use client";

import { useId, type ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { CollapsibleChevron, CollapsibleContent, useCollapsible } from "@/components/ui/CollapsibleSection";
import Switch from "@/components/ui/Switch";
import Tooltip from "@/components/ui/Tooltip";

type Props = {
    title: string;
    description?: ReactNode;
    icon?: ReactNode;
    titleBadge?: ReactNode;
    plus?: boolean;
    configured?: boolean;
    checked?: boolean;
    onChange?: (checked: boolean) => void;
    disabled?: boolean;
    ariaLabel?: string;
    toggleTooltip?: string;
    collapse?: { open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void; disabled?: boolean };
    children?: ReactNode;
    footer?: ReactNode;
    className?: string;
    embedded?: boolean;
    compact?: boolean;
};

// Shared configuration header, using the Modo Vitrine typography for features.
export default function ConfigurationCard({
    title, description, icon, titleBadge, plus, configured, checked, onChange,
    disabled, ariaLabel, toggleTooltip, collapse, children, footer, className = "", embedded = false, compact = false,
}: Props) {
    const id = useId();
    const disclosure = useCollapsible(collapse);
    const titleId = `${id}-title`;
    const descriptionId = `${id}-description`;
    const titleText = <span id={titleId} role={compact ? undefined : "heading"} aria-level={compact ? undefined : 3}
        className={compact ? "font-medium text-gray-900" : "!text-base !leading-6 !font-bold text-gray-900"}>{title}</span>;
    const heading = <>
        {icon && <span className={`mt-0.5 flex shrink-0 items-center justify-center ${compact ? checked ? "text-brand" : "text-gray-500" : ""}`}>{icon}</span>}
        <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
                {titleText}
                {plus !== undefined && <Badge preset={plus ? "featureAvailable" : "plusIncluded"} />}
                {titleBadge}
            </span>
            {description && <span id={descriptionId} className={compact ? "mt-0.5 block text-xs text-gray-500" : "mt-2 block text-sm text-gray-500"}>{description}</span>}
        </span>
    </>;
    const toggle = checked !== undefined && onChange ? (
        <Switch checked={checked} disabled={disabled} aria-label={ariaLabel ?? title}
            aria-describedby={description ? descriptionId : undefined}
            onClick={() => {
                onChange(!checked);
                if (!checked && collapse && !collapse.disabled) disclosure.setExpanded(true);
            }} />
    ) : null;
    const content = <>
        <div className={`flex justify-between gap-3 sm:gap-4 ${compact ? "items-center" : "items-start"}`}>
            {collapse ? <button {...disclosure.triggerProps} disabled={collapse.disabled}
                aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
                className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left disabled:cursor-default">{heading}</button>
                : <div className="flex min-w-0 flex-1 items-start gap-3">{heading}</div>}
            {(toggle || collapse || configured !== undefined) && (
                <div className="flex shrink-0 flex-col items-end gap-1">
                    {(toggle || collapse) && <div className="flex h-9 items-center gap-2">
                        {toggleTooltip && toggle ? <Tooltip text={toggleTooltip} parentClassName="!block">{toggle}</Tooltip> : toggle}
                        {collapse && <button {...disclosure.triggerProps} disabled={collapse.disabled}
                            aria-label={`${disclosure.expanded ? "Recolher" : "Expandir"} ${title}`}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
                            <CollapsibleChevron expanded={disclosure.expanded} />
                        </button>}
                    </div>}
                    {configured !== undefined && <Badge variant={configured ? "success" : "warning"}>{configured ? "Configurado" : "Não configurado"}</Badge>}
                </div>
            )}
        </div>
        {collapse ? <CollapsibleContent id={disclosure.contentId} expanded={disclosure.expanded}>
            <div className="space-y-4 pt-4">{children}</div>
        </CollapsibleContent> : children}
        {footer}
    </>;
    return embedded
        ? <section data-configuration-card="" aria-labelledby={titleId} className={className}>{content}</section>
        : <Card data-configuration-card="" aria-labelledby={titleId} className={`${compact ? "!p-4 min-h-[68px]" : ""} ${className}`}>{content}</Card>;
}
