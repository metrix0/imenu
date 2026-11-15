type OrderSlot = { open: string; close: string };
type WeeklyOrderHours = Record<number, OrderSlot[] | undefined> | null | undefined;

export function hasOrderHours(hours: WeeklyOrderHours): boolean {
    return Array.from({ length: 7 }, (_, day) => hours?.[day])
        .some((slots) => Array.isArray(slots) && slots.length > 0);
}

export function getOrderScheduleOptions(
    availability: WeeklyOrderHours,
    targetDate: Date,
    now: Date,
    manuallyClosedToday = false,
) {
    const isToday = targetDate.toDateString() === now.toDateString();
    const slots = availability?.[targetDate.getDay()];
    const options: { value: string; label: string }[] = [];
    if ((isToday && manuallyClosedToday) || !Array.isArray(slots)) return options;

    for (const slot of slots) {
        const [openH, openM] = String(slot.open).split(":").map(Number);
        const [closeH, closeM] = String(slot.close).split(":").map(Number);
        const openDate = new Date(targetDate);
        openDate.setHours(openH, openM, 0, 0);
        const closeDate = new Date(targetDate);
        closeDate.setHours(closeH, closeM, 0, 0);

        if (isToday && closeDate <= now) continue;

        let firstAvailable = new Date(openDate);
        if (isToday && now >= openDate) {
            firstAvailable = new Date(now);
            firstAvailable.setSeconds(0, 0);
            const minutes = firstAvailable.getMinutes();
            const remainder = minutes % 15;
            firstAvailable.setMinutes(
                remainder === 0
                    ? minutes + 15
                    : minutes + (15 - remainder),
                0,
                0
            );
        }

        if (firstAvailable < openDate) {
            firstAvailable = openDate;
        }

        for (
            let cursor = new Date(firstAvailable);
            cursor <= closeDate;
            cursor = new Date(cursor.getTime() + 15 * 60_000)
        ) {
            options.push({
                value: cursor.toISOString(),
                label: cursor.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
            });
        }
    }

    return options;
}
