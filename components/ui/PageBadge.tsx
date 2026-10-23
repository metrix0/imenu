import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import Badge from "@/components/ui/Badge";
import { PanelIcon } from "@/components/ui/PanelIcon";

type PageBadgeProps = {
    href: LinkProps["href"];
    icon: IconDefinition;
    children: ReactNode;
    className?: string;
};

// Reusable, compact navigation badge with the destination page's icon.
export default function PageBadge({ href, icon, children, className = "" }: PageBadgeProps) {
    return (
        <Link
            href={href}
            className={`group inline-flex cursor-pointer align-middle no-underline outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 ${className}`}
        >
            <Badge variant="neutral" mode="page" className="transition-colors group-hover:bg-gray-100">
                <PanelIcon icon={icon} aria-hidden="true" />
                <span>{children}</span>
            </Badge>
        </Link>
    );
}
