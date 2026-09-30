import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faCircleInfo, faStar } from "@fortawesome/free-solid-svg-icons";
import Tooltip from "@/components/ui/Tooltip";

type RecommendedBadgeProps = {
    className?: string;
    infoText?: string;
};

export default function RecommendedBadge({
    className = "",
    infoText,
}: RecommendedBadgeProps) {
    return (
        <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide !text-brand ring-1 ring-inset ring-brand/25 ${className}`}
        >
            <FontAwesomeIcon icon={faStar} className="text-[8px]" />
            Recomendado
            {infoText && (
                <Tooltip
                    text={infoText}
                    size="medium"
                    showOnClick
                    parentClassName="shrink-0 leading-none"
                >
                    <button
                        type="button"
                        aria-label="Mais informações sobre a recomendação"
                        className="inline-flex h-3.5 w-3.5 items-center justify-center !text-brand"
                    >
                        <FontAwesomeIcon icon={faCircleInfo} className="text-[9px]" />
                    </button>
                </Tooltip>
            )}
        </span>
    );
}
