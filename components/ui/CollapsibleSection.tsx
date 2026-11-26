"use client";

import { useId, useState, type ReactNode } from "react";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { PanelIcon } from "@/components/ui/PanelIcon";
import Switch from "@/components/ui/Switch";

export function useCollapsible({ open, defaultOpen = false, onOpenChange }: {
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
} = {}) {
    const id = useId();
    const contentId = `${id}-content`;
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const expanded = open ?? internalOpen;

    function setExpanded(next: boolean) {
        if (next === expanded) return;
        if (open === undefined) setInternalOpen(next);
        onOpenChange?.(next);
    }

    return {
        id, contentId, expanded, setExpanded,
        triggerProps: {
            type: "button" as const,
            "aria-expanded": expanded,
            "aria-controls": contentId,
            onClick: () => setExpanded(!expanded),
        },
    };
}

const chevronSizes = {
    sm: { pixels: 12, dimensions: "!h-3 !w-3" },
    md: { pixels: 16, dimensions: "!h-4 !w-4" },
    default: { pixels: 24, dimensions: "!h-6 !w-6" },
};

type ChevronSize = keyof typeof chevronSizes;

export function CollapsibleChevron({ expanded, size = "default", className = "" }: {
    expanded: boolean;
    size?: ChevronSize;
    className?: string;
}) {
    const { pixels, dimensions } = chevronSizes[size];

    return (
        <PanelIcon
            icon={faChevronDown}
            aria-hidden="true"
            style={{ width: pixels, height: pixels }}
            data-ui="disclosure-chevron"
            className={`${dimensions} shrink-0 transition-transform duration-200 motion-reduce:transition-none ${expanded ? "rotate-180" : ""} ${className}`}
        />
    );
}

export function CollapsibleContent({ id, expanded, children, className = "" }: {
    id: string;
    expanded: boolean;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            id={id}
            aria-hidden={!expanded}
            inert={!expanded}
            className={`grid min-w-0 grid-cols-[minmax(0,1fr)] transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"} ${className}`}
        >
            <div className="min-h-0 min-w-0 overflow-hidden">{children}</div>
        </div>
    );
}

type CollapsibleSectionProps = {
    title: string;
    titleClassName?: string;
    description?: string;
    icon?: ReactNode;
    badge?: ReactNode;
    titleBadge?: ReactNode;
    badgeFirst?: boolean;
    children: ReactNode;
    footer?: ReactNode;
    chevronSize?: ChevronSize;
    inlineChevron?: boolean;
    className?: string;
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    toggle?: {
        checked: boolean;
        disabled?: boolean;
        label?: string;
        onChange: (checked: boolean) => void;
    };
};

export default function CollapsibleSection({
    title,
    titleClassName = "text-sm font-medium",
    description,
    icon,
    badge,
    titleBadge,
    badgeFirst = false,
    children,
    footer,
    chevronSize,
    inlineChevron = false,
    className = "",
    defaultOpen = false,
    open,
    onOpenChange,
    toggle,
}: CollapsibleSectionProps) {
    const { id, contentId, expanded, setExpanded, triggerProps } = useCollapsible({ open, defaultOpen, onOpenChange });
    const titleId = `${id}-title`;
    const descriptionId = `${id}-description`;

    function changeToggle() {
        if (!toggle) return;
        const next = !toggle.checked;
        toggle.onChange(next);
        if (next) setExpanded(true);
    }

    return (
        <section className={className} aria-labelledby={titleId}>
            <div className="flex items-start gap-3 sm:gap-4">
                <button
                    {...triggerProps}
                    aria-labelledby={titleId}
                    aria-describedby={description ? descriptionId : undefined}
                    className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-start gap-3 text-left sm:gap-4"
                >
                    {icon && (
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden="true">
                            {icon}
                        </span>
                    )}
                    <span className="min-w-0 flex-1">
                        <span
                            id={titleId}
                            className={`${inlineChevron || titleBadge ? "flex flex-wrap items-center gap-2" : "block"} ${titleClassName} text-gray-900`}
                        >
                            {inlineChevron ? (
                                <>
                                    <span>{title}</span>
                                    {titleBadge}
                                    <CollapsibleChevron expanded={expanded} size={chevronSize} />
                                </>
                            ) : <>{title}{titleBadge}</>}
                        </span>
                        {description && <span id={descriptionId} className="mt-1 block text-sm text-gray-500">{description}</span>}
                    </span>
                </button>
                {(!inlineChevron || toggle || badge) && (
                    <div className={badgeFirst ? "flex shrink-0 flex-row items-center gap-2 sm:gap-3" : "flex shrink-0 flex-col items-end sm:flex-row sm:items-center sm:gap-3"}>
                        {(toggle || !inlineChevron) && (
                            <div className="flex h-9 items-center gap-2 sm:gap-3">
                                {toggle && (
                                    <Switch
                                        aria-label={toggle.label ?? `Ativar ${title}`}
                                        checked={toggle.checked}
                                        disabled={toggle.disabled}
                                        onClick={changeToggle}
                                    />
                                )}
                                {!inlineChevron && (
                                    <button
                                        {...triggerProps}
                                        aria-label={`${expanded ? "Recolher" : "Expandir"} ${title}`}
                                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50"
                                    >
                                        <CollapsibleChevron expanded={expanded} size={chevronSize} />
                                    </button>
                                )}
                            </div>
                        )}
                        {badge && <span className={badgeFirst ? "order-first self-center" : "sm:order-first"}>{badge}</span>}
                    </div>
                )}
            </div>
            <CollapsibleContent id={contentId} expanded={expanded}>
                <div className={`space-y-4 pt-4 ${icon ? "sm:pl-[52px]" : ""}`}>{children}</div>
            </CollapsibleContent>
            {footer}
        </section>
    );
}
