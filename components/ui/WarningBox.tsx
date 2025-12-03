import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

type WarningBoxProps = React.HTMLAttributes<HTMLDivElement> & {
    icon: IconDefinition;
    children: React.ReactNode;
};

export default function WarningBox({ icon, children, className = "", ...props }: WarningBoxProps) {
    return (
        <div
            className={`p-4 bg-warning-bg text-warning flex gap-4 rounded-2xl  items-center ${className}`}
            {...props}
        >
            <FontAwesomeIcon icon={icon} className="text-lg" />
            <div>{children}</div>
        </div>
    );
}
