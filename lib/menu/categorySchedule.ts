export type CategoryScheduleRule = {
    /** Empty means all days. 0 = Sunday, 6 = Saturday. */
    days: number[];
    /** Null means no daily time limit. */
    start: string | null;
    end: string | null;
};
export type CategorySchedule = CategoryScheduleRule[] | null;

export const CATEGORY_WEEKDAYS = [
    { day: 1, label: "Seg" },
    { day: 2, label: "Ter" },
    { day: 3, label: "Qua" },
    { day: 4, label: "Qui" },
    { day: 5, label: "Sex" },
    { day: 6, label: "Sáb" },
    { day: 0, label: "Dom" },
] as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const brazilClock = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
});
const minutes = (time: string) => {
    const [hours, mins] = time.split(":").map(Number);
    return hours * 60 + mins;
};

export function validateCategorySchedule(schedule: CategorySchedule): string | null {
    if (schedule === null) return null;
    if (!Array.isArray(schedule) || !schedule.length) return "Adicione ao menos um intervalo.";
    for (const rule of schedule) {
        if (!rule || !Array.isArray(rule.days) ||
            rule.days.some(day => !Number.isInteger(day) || day < 0 || day > 6) ||
            new Set(rule.days).size !== rule.days.length) return "Selecione dias válidos.";
        if ((rule.start === null) !== (rule.end === null)) return "Informe o início e o fim do horário.";
        if (rule.start !== null && rule.end !== null) {
            if (!TIME_PATTERN.test(rule.start) || !TIME_PATTERN.test(rule.end) || rule.start === rule.end) {
                return "Informe dois horários válidos e diferentes.";
            }
        } else if (!rule.days.length) {
            return "Escolha dias ou um intervalo de horário para agendar.";
        }
    }
    return null;
}

export function isCategoryAvailable(schedule: CategorySchedule | undefined, at: Date): boolean {
    if (schedule == null) return true;
    if (!Array.isArray(schedule) || !schedule.length) return false;
    const parts = Object.fromEntries(brazilClock.formatToParts(at).map(part => [part.type, part.value]));
    const day = WEEKDAY.indexOf(parts.weekday);
    const time = Number(parts.hour) * 60 + Number(parts.minute);
    if (day < 0 || !Number.isFinite(time)) return false;
    const yesterday = (day + 6) % 7;
    const matchesDay = (rule: CategoryScheduleRule, onDay: number) =>
        !rule.days.length || rule.days.includes(onDay);

    return schedule.some(rule => {
        if (!rule || !Array.isArray(rule.days)) return false;
        if (rule.start === null && rule.end === null) return matchesDay(rule, day);
        if (!rule.start || !rule.end || !TIME_PATTERN.test(rule.start) || !TIME_PATTERN.test(rule.end)) return false;
        const start = minutes(rule.start), end = minutes(rule.end);
        if (start === end) return false;
        if (start < end) return matchesDay(rule, day) && time >= start && time < end;
        return (matchesDay(rule, day) && time >= start) || (matchesDay(rule, yesterday) && time < end);
    });
}

function daysLabel(days: number[]): string {
    if (!days.length || days.length === 7) return "Todos os dias";
    const chosen = CATEGORY_WEEKDAYS.filter(d => days.includes(d.day));
    const firstIndex = CATEGORY_WEEKDAYS.findIndex(d => d.day === chosen[0]?.day);
    const continuous = chosen.length >= 3 && chosen.every((d, index) =>
        CATEGORY_WEEKDAYS.findIndex(v => v.day === d.day) === firstIndex + index);
    if (continuous) return `${chosen[0].label}–${chosen[chosen.length - 1].label}`;
    return chosen.map(d => d.label).join(", ");
}

export function categoryScheduleDetails(schedule: CategorySchedule | undefined): string | null {
    if (!Array.isArray(schedule) || !schedule.length) return null;
    return schedule.map(rule => `${daysLabel(rule.days)} · ${rule.start && rule.end ? `${rule.start}–${rule.end}` : "Dia inteiro"}`).join(" | ");
}

export function categoryScheduleLabel(schedule: CategorySchedule | undefined): string | null {
    if (!Array.isArray(schedule) || !schedule.length) return null;
    const first = schedule[0];
    const period = first.start && first.end ? `${first.start}–${first.end}` : "Dia inteiro";
    const summary = `${daysLabel(first.days)} · ${period}`;
    return schedule.length === 1 ? summary : `${summary} (+${schedule.length - 1})`;
}
