import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

type WarningBoxProps = React.HTMLAttributes<HTMLDivElement> & {
    icon: IconDefinition;
    children: React.ReactNode;
};

export default function WarningBox({ icon, children, className = "", ...props }: WarningBoxProps) {
    return (
        <div
            data-ui="warning"
            className={`flex items-center gap-2.5 rounded-lg bg-warning-bg p-3.5 text-[13px] text-warning ${className}`}
            {...props}
        >
            <FontAwesomeIcon icon={icon} className="text-lg" />
            <div>{children}</div>
        </div>
    );
}
