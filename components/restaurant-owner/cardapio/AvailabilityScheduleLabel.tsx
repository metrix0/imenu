import { faClock } from "@fortawesome/free-solid-svg-icons";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { categoryScheduleDetails, categoryScheduleLabel, type CategorySchedule } from "@/lib/menu/categorySchedule";

export default function AvailabilityScheduleLabel({
    schedule,
    className = "inline-flex",
    iconOnly = false,
}: {
    schedule?: CategorySchedule;
    className?: string;
    iconOnly?: boolean;
}) {
    const label = categoryScheduleLabel(schedule);
    if (!label) return null;

    return (
        <span
            className={`min-w-0 max-w-[220px] items-center gap-1.5 text-xs text-gray-500 ${className}`}
            title={categoryScheduleDetails(schedule) ?? undefined}
        >
            <PanelIcon icon={faClock} className="shrink-0" style={{ width: "1em", height: "1em" }} aria-hidden="true" />
            <span className={iconOnly ? "sr-only" : "truncate"}>{label}</span>
        </span>
    );
}
