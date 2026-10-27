import Link, { type LinkProps } from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { PanelIcon } from "@/components/ui/PanelIcon";

type PageBadgeProps = {
    href: LinkProps["href"];
    icon: IconDefinition;
    children: ReactNode;
    size?: "inline" | "button";
    tone?: "brand" | "inherit";
    newTab?: boolean;
    className?: string;
    "aria-label"?: string;
};

// Shared navigation badge used by panel links, including Assistente IA.
export default function PageBadge({
    href,
    icon,
    children,
    size = "inline",
    tone = "brand",
    newTab = false,
    className = "",
    "aria-label": ariaLabel,
}: PageBadgeProps) {
    const inline = size === "inline";
    return (
        <Link
            data-ui={inline ? undefined : "button"}
            href={href}
            target={newTab ? "_blank" : undefined}
            rel={newTab ? "noopener noreferrer" : undefined}
            aria-label={ariaLabel}
            className={`inline-flex cursor-pointer items-center justify-center font-medium no-underline transition-[background-color,border-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-[3px] ${inline
                ? "gap-1 rounded-[6px] border px-2 py-0.5 align-baseline text-xs leading-5"
                : "mt-3 min-h-10 gap-2 rounded-[8px] border px-[14px] py-[9px] text-[13px] leading-5"
            } ${tone === "inherit"
                ? "border-current/25 bg-transparent text-inherit hover:bg-current/10 focus-visible:outline-current"
                : inline
                    ? "border-brand/20 bg-brand/5 text-brand hover:bg-brand/10 focus-visible:outline-brand"
                    : "border-[#e2e5e9] bg-white text-[#1d1d1d] hover:bg-[#f1f3f5] focus-visible:outline-[#626973]"
            } ${className}`}
        >
            <PanelIcon icon={icon} className="text-base" aria-hidden="true" />
            {children}
            <ArrowUpRight size={inline ? 12 : 14} aria-hidden="true" />
        </Link>
    );
}
