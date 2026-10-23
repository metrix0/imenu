export type AutomationKind = "cart" | "reactivation" | "habit";
export type AutomationRule = {
  enabled: boolean;
  message: string;
  days: number;
  dailyLimit: number;
  cooldownDays: number;
  offer: string;
};
export type AutomationSettings = Record<AutomationKind, AutomationRule>;
export const AUTOMATION_LABELS: Record<AutomationKind, string> = {
  cart: "Recuperação de carrinho",
  reactivation: "Reativação de clientes",
  habit: "Hábitos de compra",
};
export const DEFAULT_AUTOMATIONS: AutomationSettings = {
  cart: {
    enabled: false,
    message:
      "Oi, {{nome}}! Seus favoritos ficaram no carrinho da {{restaurante}}. Que tal finalizar seu pedido? 😋",
    days: 1,
    dailyLimit: 7,
    cooldownDays: 7,
    offer: "",
  },
  reactivation: {
    enabled: false,
    message:
      "Oi, {{nome}}! Estamos com saudade de você na {{restaurante}}. Que tal pedir algo gostoso hoje? 🍔",
    days: 30,
    dailyLimit: 2,
    cooldownDays: 120,
    offer: "",
  },
  habit: {
    enabled: false,
    message:
      "Oi, {{nome}}! Sua hora favorita de pedir na {{restaurante}} está chegando. Já escolheu o que vai querer hoje? 😋",
    days: 1,
    dailyLimit: 2,
    cooldownDays: 7,
    offer: "",
  },
};
export const AUTOMATION_KINDS = Object.keys(
  DEFAULT_AUTOMATIONS,
) as AutomationKind[];
export function normalizeCustomerPhone(value: unknown): string | null {
  const phone = String(value ?? "").replace(/\D/g, "");
  if (/^55\d{10,11}$/.test(phone)) return phone;
  return /^\d{10,11}$/.test(phone) ? `55${phone}` : null;
}
export function readAutomationSettings(value: unknown): AutomationSettings {
  const source =
    value && typeof value === "object" ? (value as Record<string, any>) : {};
  return Object.fromEntries(
    AUTOMATION_KINDS.map((kind) => {
      const base = DEFAULT_AUTOMATIONS[kind],
        rule = source[kind] || {};
      return [
        kind,
        {
          ...base,
          enabled: rule.enabled === true,
          message:
            typeof rule.message === "string" && rule.message.trim()
              ? rule.message.trim().slice(0, 1500)
              : base.message,
          days: Math.max(
            1,
            Math.min(365, Math.floor(Number(rule.days) || base.days)),
          ),
          dailyLimit: Math.max(
            1,
            Math.min(
              base.dailyLimit,
              Math.floor(Number(rule.dailyLimit) || base.dailyLimit),
            ),
          ),
          cooldownDays: Math.max(
            base.cooldownDays,
            Math.min(
              365,
              Math.floor(Number(rule.cooldownDays) || base.cooldownDays),
            ),
          ),
          offer: typeof rule.offer === "string" ? rule.offer.slice(0, 100) : "",
        },
      ];
    }),
  ) as AutomationSettings;
}
export const CUSTOMER_SEGMENTS = [
  "Destaque",
  "Frequente",
  "Novo",
  "Em risco",
  "Inativo",
] as const;
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];
export function customerSegment(
  count: number,
  spending: number,
  lastPurchase: string | null,
  now = Date.now(),
): CustomerSegment {
  const age = lastPurchase
    ? (now - new Date(lastPurchase).getTime()) / 86400000
    : Infinity;
  if (age >= 60) return "Inativo";
  if (age >= 30) return "Em risco";
  if (count >= 10 || spending >= 100000) return "Destaque";
  if (count >= 3) return "Frequente";
  return "Novo";
}
// Shared with the habit automation: three distinct dates at the same
// weekday/hour, interpreted in America/Sao_Paulo.
export type PurchaseHabit = {
  weekday: string;
  hour: number;
  count: number;
};
const habitFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  hourCycle: "h23",
});
const habitLocalTime = (date: Date) =>
  habitFormatter.formatToParts(date).reduce(
    (parts, part) => ({ ...parts, [part.type]: part.value }),
    {} as Record<string, string>,
  );
export function purchaseHabits(dates: string[]): PurchaseHabit[] {
  const groups = new Map<string, { weekday: string; hour: number; days: Set<string> }>();
  for (const date of dates) {
    const local = habitLocalTime(new Date(date));
    const hour = Number(local.hour);
    const key = `${local.weekday}:${hour}`;
    if (!groups.has(key)) groups.set(key, { weekday: local.weekday, hour, days: new Set() });
    groups.get(key)!.days.add(`${local.year}-${local.month}-${local.day}`);
  }
  return [...groups.values()]
    .filter((group) => group.days.size >= 3)
    .map(({ weekday, hour, days }) => ({ weekday, hour, count: days.size }))
    .sort((a, b) => b.count - a.count || a.weekday.localeCompare(b.weekday) || a.hour - b.hour);
}
export function habitDue(dates: string[], now = new Date()): string | null {
  const upcoming = habitLocalTime(new Date(now.getTime() + 2 * 3600000));
  const matching = purchaseHabits(dates).some(
    (habit) => habit.weekday === upcoming.weekday && habit.hour === Number(upcoming.hour),
  );
  return matching
    ? `${upcoming.year}-${upcoming.month}-${upcoming.day}:${upcoming.hour}`
    : null;
}

// Historical checkout orders kept a formatted address instead of separate fields.
export function legacyCheckoutAddress(
  value: unknown,
): Record<string, string> | null {
  const match = String(value || "").match(
    /^(.+),\s*([^,]+?)\s*-\s*(.*?)\s*-\s*(\d{5}-?\d{3})(?:\s*\((.*)\))?$/,
  );
  return match
    ? {
        rua: match[1].trim(),
        numero: match[2].trim(),
        bairro: match[3].trim(),
        cep: match[4].replace(/\D/g, ""),
        complemento: (match[5] || "").trim(),
        cidade: "",
        estado: "",
      }
    : null;
}
