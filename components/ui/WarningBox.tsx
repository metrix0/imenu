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
            className={`p-[14px] bg-warning-bg text-warning flex gap-[10px] rounded-[8px] items-center text-[13px] ${className}`}
            {...props}
        >
            <FontAwesomeIcon icon={icon} className="text-lg" />
            <div>{children}</div>
        </div>
    );
}
