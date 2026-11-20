import { parseNeighborhoodDeliveryRules, type NeighborhoodDeliveryRule } from "@/lib/delivery/neighborhood";
import { isManualOpeningActive, isStoreManuallyClosed } from "./storeHoursOverride";

type OrderSlot = { open: string; close: string };
type WeeklyOrderHours = Record<number, OrderSlot[] | undefined> | null | undefined;
type OrderScheduleSettings = {
    availability_json?: WeeklyOrderHours;
    is_closed?: string | null;
    manual_open_until?: string | null;
    preorder_only?: boolean;
    delivery_fee_mode?: string | null;
    delivery_fee_json?: unknown;
    delivery_neighborhood_fee_json?: unknown;
};

const STORE_TIME_ZONE = "America/Sao_Paulo";
const SLOT_MS = 15 * 60_000;
const storeDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
const slotLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: STORE_TIME_ZONE, hour: "2-digit", minute: "2-digit",
});

export function getOrderScheduleDate(date: Date): string {
    return storeDay.format(date);
}

export function hasOrderHours(hours: WeeklyOrderHours): boolean {
    return Array.from({ length: 7 }, (_, day) => hours?.[day])
        .some((slots) => Array.isArray(slots) && slots.length > 0);
}

function minutesFromTime(value: string | undefined) {
    const [hour, minute] = String(value).split(":").map(Number);
    return hour * 60 + minute;
}

function getDayWindows(availability: WeeklyOrderHours, day: string) {
    const dayStart = Date.parse(day + "T00:00:00-03:00");
    const slots = availability?.[new Date(dayStart).getUTCDay()];
    if (!Array.isArray(slots)) return [];
    return slots.flatMap(slot => {
        const open = dayStart + minutesFromTime(slot?.open) * 60_000;
        const closeMinutes = minutesFromTime(slot?.close);
        const close = dayStart + (closeMinutes === 0 || closeMinutes === 1440 ? 1439 : closeMinutes) * 60_000;
        return Number.isFinite(open) && Number.isFinite(close) && close >= open ? [{ open, close }] : [];
    });
}

export function getSameDayOrderEarliestAt(
    settings: OrderScheduleSettings,
    now: Date,
    neighborhoodRules?: readonly NeighborhoodDeliveryRule[],
): number | null {
    if (settings.preorder_only === true) return null;

    const nowMs = now.getTime();
    const manuallyOpen = isManualOpeningActive(settings.manual_open_until, now);
    if (!manuallyOpen && (isStoreManuallyClosed(settings.is_closed, now) ||
        !getDayWindows(settings.availability_json, getOrderScheduleDate(now))
            .some(({ open, close }) => open <= nowMs && nowMs <= close))) {
        return null;
    }

    const rules = neighborhoodRules ?? (settings.delivery_fee_mode === "neighborhood"
        ? parseNeighborhoodDeliveryRules(settings.delivery_neighborhood_fee_json)
        : settings.delivery_fee_json);
    if (!Array.isArray(rules)) return null;
    const maxMinutes = rules.reduce((max, rule) => {
        const minutes = Number(rule?.time_minutes);
        return Number.isFinite(minutes) ? Math.max(max, minutes) : max;
    }, 0);
    // The checkout shows and accepts whole-minute times.
    return maxMinutes > 0 ? (Math.floor(nowMs / 60_000) + maxMinutes) * 60_000 : null;
}

export function getOrderScheduleOptions(
    availability: WeeklyOrderHours,
    targetDay: string,
    now: Date,
    manuallyClosedToday = false,
    earliestSameDayAt: number | null = null,
) {
    const isToday = targetDay === getOrderScheduleDate(now);
    const options: { value: string; label: string }[] = [];
    if (isToday && manuallyClosedToday) return options;

    const nowMs = now.getTime();
    for (const { open, close } of getDayWindows(availability, targetDay)) {
        if (isToday && close <= nowMs) continue;

        let firstAvailable = isToday && nowMs >= open
            ? (Math.floor(nowMs / SLOT_MS) + 1) * SLOT_MS
            : open;
        if (isToday && earliestSameDayAt !== null && firstAvailable < earliestSameDayAt) {
            firstAvailable += Math.ceil((earliestSameDayAt - firstAvailable) / SLOT_MS) * SLOT_MS;
        }

        for (let cursor = firstAvailable; cursor <= close; cursor += SLOT_MS) {
            const date = new Date(cursor);
            options.push({ value: date.toISOString(), label: slotLabel.format(date) });
        }
    }

    return options;
}
