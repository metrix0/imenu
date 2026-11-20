import { faClock } from "@fortawesome/free-solid-svg-icons";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { categoryScheduleDetails, categoryScheduleLabel, type CategorySchedule } from "@/lib/menu/categorySchedule";

export default function AvailabilityScheduleLabel({
    schedule,
    className = "",
    showClock = false,
}: {
    schedule?: CategorySchedule;
    className?: string;
    showClock?: boolean;
}) {
    const label = categoryScheduleLabel(schedule);
    if (!label) return null;

    return (
        <span
            className={`max-w-[220px] truncate text-xs text-gray-500 ${className}`}
            title={categoryScheduleDetails(schedule) ?? undefined}
        >
            {showClock && <PanelIcon icon={faClock} className="mr-1 text-[10px]" aria-hidden="true" />}
            {label}
        </span>
    );
}
