import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faStar } from "@fortawesome/free-solid-svg-icons";

type RecommendedBadgeProps = {
    className?: string;
};

export default function RecommendedBadge({
    className = "",
}: RecommendedBadgeProps) {
    return (
        <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide !text-brand ring-1 ring-inset ring-brand/25 ${className}`}
        >
            <FontAwesomeIcon icon={faStar} className="text-[8px]" />
            Recomendado
        </span>
    );
}
