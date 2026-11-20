import { categoryScheduleDetails, categoryScheduleLabel, type CategorySchedule } from "@/lib/menu/categorySchedule";

export default function AvailabilityScheduleLabel({
    schedule,
    className = "",
}: {
    schedule?: CategorySchedule;
    className?: string;
}) {
    const label = categoryScheduleLabel(schedule);
    if (!label) return null;

    return (
        <span
            className={`max-w-[220px] truncate text-xs text-gray-500 ${className}`}
            title={categoryScheduleDetails(schedule) ?? undefined}
        >
            {label}
        </span>
    );
}
