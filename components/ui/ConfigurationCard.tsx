"use client";

import { useId, type ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { CollapsibleChevron, CollapsibleContent, useCollapsible } from "@/components/ui/CollapsibleSection";
import Switch from "@/components/ui/Switch";
import Tooltip from "@/components/ui/Tooltip";

type Props = {
    title: string;
    mobileTitle?: ReactNode;
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
    title, mobileTitle, description, icon, titleBadge, plus, configured, checked, onChange,
    disabled, ariaLabel, toggleTooltip, collapse, children, footer, className = "", embedded = false, compact = false,
}: Props) {
    const id = useId();
    const disclosure = useCollapsible(collapse);
    const titleId = `${id}-title`;
    const descriptionId = `${id}-description`;
    const showConfigurationStatus = configured !== undefined && checked !== false;
    const reserveConfigurationStatus = Boolean(collapse && configured !== undefined);
    const titleText = <span id={titleId} role={compact ? undefined : "heading"} aria-level={compact ? undefined : 3}
        className={compact ? "font-medium text-gray-900" : "!text-base !leading-6 !font-bold text-gray-900"}>{mobileTitle ? <><span className="sm:hidden">{mobileTitle}</span><span className="hidden sm:inline">{title}</span></> : title}</span>;
    const heading = <>
        {icon && <span className={`mt-0.5 flex shrink-0 items-center justify-center ${compact ? checked ? "text-brand" : "text-gray-500" : ""}`}>{icon}</span>}
        <span className="min-w-0 flex-1">
            <span className={plus !== undefined ? "block sm:flex sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1" : "flex flex-wrap items-center gap-x-2 gap-y-1"}>
                {titleText}
                {plus !== undefined && <>{" "}<Badge preset={plus ? "featureAvailable" : "plusIncluded"} className="ml-1 whitespace-nowrap sm:ml-0" /></>}
                {titleBadge}
            </span>
        </span>
    </>;
    const toggle = checked !== undefined && onChange ? (
        <Switch checked={collapse && checked && configured === false ? "mixed" : checked} disabled={disabled} aria-label={ariaLabel ?? title}
            aria-describedby={description ? descriptionId : undefined}
            onClick={() => {
                onChange(!checked);
                if (!checked && collapse && !collapse.disabled) disclosure.setExpanded(true);
            }} />
    ) : null;
    const content = <>
        <div className={`flex min-w-0 justify-between gap-2 sm:gap-3 ${compact ? "items-center" : "items-start"}`}>
            {collapse ? <button {...disclosure.triggerProps} disabled={collapse.disabled}
                aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
                className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 text-left disabled:cursor-default">{heading}</button>
                : <div className="flex min-w-0 flex-1 items-start gap-2">{heading}</div>}
            {(toggle || collapse || configured !== undefined) && (
                <div className={collapse ? "flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3" : "flex shrink-0 items-center gap-2 sm:gap-3"}>
                    {(toggle || collapse) && <div className="flex h-9 items-center gap-2">
                        {toggleTooltip && toggle ? <Tooltip text={toggleTooltip} parentClassName="!block">{toggle}</Tooltip> : toggle}
                        {collapse && <button {...disclosure.triggerProps} disabled={collapse.disabled}
                            aria-label={`${disclosure.expanded ? "Recolher" : "Expandir"} ${title}`}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
                            <CollapsibleChevron expanded={disclosure.expanded} />
                        </button>}
                    </div>}
                    {(showConfigurationStatus || reserveConfigurationStatus) && (
                        <span className={collapse ? `sm:order-first ${showConfigurationStatus ? "" : "invisible sm:hidden"}` : "order-first"}
                            aria-hidden={!showConfigurationStatus}>
                            {reserveConfigurationStatus ? (
                                <span className="grid justify-items-end">
                                    <Badge aria-hidden="true" variant="warning" className="invisible col-start-1 row-start-1 sm:hidden">Não configurado</Badge>
                                    <Badge variant={configured ? "success" : "warning"} className="col-start-1 row-start-1">{configured ? "Configurado" : "Não configurado"}</Badge>
                                </span>
                            ) : <Badge variant={configured ? "success" : "warning"}>{configured ? "Configurado" : "Não configurado"}</Badge>}
                        </span>
                    )}
                </div>
            )}
        </div>
        {description && <div id={descriptionId} className={`min-w-0 break-words ${compact ? "mt-0.5 text-xs" : "mt-1 text-sm"} text-gray-500`}>{description}</div>}
        {collapse ? <CollapsibleContent id={disclosure.contentId} expanded={disclosure.expanded} className="[overflow-anchor:none]">
            <div className="min-w-0 space-y-3 pt-3">{children}</div>
        </CollapsibleContent> : children}
        {footer}
    </>;
    return embedded
        ? <section data-configuration-card="" aria-labelledby={titleId} className={`min-w-0 ${className}`}>{content}</section>
        : <Card data-configuration-card="" aria-labelledby={titleId} className={`min-w-0 ${compact ? "!p-3" : "!p-3 sm:!p-4"} ${className}`}>{content}</Card>;
}
