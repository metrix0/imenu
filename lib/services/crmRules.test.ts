import {
  normalizeCustomerPhone,
  customerSegment,
  habitDue,
  purchaseHabits,
  readAutomationSettings,
  automationDailyShares,
  DEFAULT_AUTOMATION_DAILY_LIMIT,
  legacyCheckoutAddress,
} from "./crmRules";
describe("CRM rules", () => {
  test("local and international Brazilian phones share an identity", () => {
    expect(normalizeCustomerPhone("(19) 99999-1234")).toBe("5519999991234");
    expect(normalizeCustomerPhone("+55 (19) 99999-1234")).toBe("5519999991234");
    expect(normalizeCustomerPhone("123")).toBeNull();
  });
  test("inactivity takes precedence over VIP and metrics remain time dependent", () => {
    const now = new Date("2026-10-23T20:00:00Z").getTime();
    expect(customerSegment(50, 200000, "2026-08-01T20:00:00Z", now)).toBe(
      "Inativo",
    );
    expect(customerSegment(50, 200000, "2026-09-20T20:00:00Z", now)).toBe(
      "Em risco",
    );
    expect(customerSegment(10, 90000, "2026-10-20T20:00:00Z", now)).toBe("VIP");
    expect(customerSegment(3, 9000, "2026-10-20T20:00:00Z", now)).toBe(
      "Frequente",
    );
  });
  test("shared daily cap defaults to 10, ignores old per-type limits and protects cooldowns", () => {
    const settings = readAutomationSettings({
      dailyTotalLimit: 18,
      habit: { enabled: true, dailyLimit: 999, cooldownDays: 1 },
      reactivation: { enabled: true, days: 365, dailyLimit: 999, cooldownDays: 1 },
      cart: { enabled: true, dailyLimit: 999, cooldownDays: 0 },
    });
    expect(settings.dailyTotalLimit).toBe(18);
    expect(settings.reactivation).toMatchObject({ enabled: true, days: 30, cooldownDays: 120 });
    expect(settings.cart).toMatchObject({ enabled: true, cooldownDays: 7 });
    expect(settings.cart).not.toHaveProperty("dailyLimit");
    expect(readAutomationSettings(null).dailyTotalLimit).toBe(DEFAULT_AUTOMATION_DAILY_LIMIT);
    expect(readAutomationSettings({ dailyTotalLimit: 9999 }).dailyTotalLimit).toBe(1000);
    expect(readAutomationSettings({ dailyTotalLimit: -4 }).dailyTotalLimit).toBe(1);
  });
  test("active automation weights distribute budget using largest remainders", () => {
    const settings = readAutomationSettings({
      dailyTotalLimit: 18,
      habit: { enabled: true },
      reactivation: { enabled: true },
      cart: { enabled: true },
    });
    expect(automationDailyShares(settings)).toEqual({ cart: 6, reactivation: 4, habit: 8 });
    settings.dailyTotalLimit = 9;
    expect(automationDailyShares(settings)).toEqual({ cart: 3, reactivation: 2, habit: 4 });
    settings.dailyTotalLimit = 10;
    expect(automationDailyShares(settings)).toEqual({ cart: 3, reactivation: 2, habit: 5 });
    settings.cart.enabled = false;
    settings.dailyTotalLimit = 12;
    expect(automationDailyShares(settings)).toEqual({ cart: 0, reactivation: 4, habit: 8 });
    settings.habit.enabled = false;
    expect(automationDailyShares(settings)).toEqual({ cart: 0, reactivation: 12, habit: 0 });
  });
  test("profile habits use the same distinct-day weekday/hour rule as automation", () => {
    const dates = [
      "2026-10-02T23:00:00Z",
      "2026-10-09T23:00:00Z",
      "2026-10-16T23:00:00Z",
      "2026-10-16T23:00:00Z",
      "2026-10-16T22:00:00Z",
    ];
    expect(purchaseHabits(dates)).toEqual([{ weekday: "Fri", hour: 20, count: 3 }]);
    expect(habitDue(dates, new Date("2026-10-23T21:00:00Z"))).toBe("2026-10-23:20");
    expect(purchaseHabits(dates.slice(2))).toEqual([]);
  });
  test("habit requires three different weeks and handles midnight in Brazil", () => {
    const fridays = [
      "2026-10-02T23:00:00Z",
      "2026-10-09T23:00:00Z",
      "2026-10-16T23:00:00Z",
    ];
    expect(habitDue(fridays, new Date("2026-10-23T21:00:00Z"))).toBe(
      "2026-10-23:20",
    );
    expect(
      habitDue(
        [fridays[0], fridays[0], fridays[1]],
        new Date("2026-10-23T21:00:00Z"),
      ),
    ).toBeNull();
    const saturday = [
      "2026-10-03T03:00:00Z",
      "2026-10-10T03:00:00Z",
      "2026-10-17T03:00:00Z",
    ];
    expect(habitDue(saturday, new Date("2026-10-24T01:00:00Z"))).toBe(
      "2026-10-24:00",
    );
  });
});

test("historical order addresses can fill checkout without extra stored copies", () => {
  expect(
    legacyCheckoutAddress("Rua das Flores, 123 - Centro - 12345-678 (Apto 2)"),
  ).toMatchObject({
    rua: "Rua das Flores",
    numero: "123",
    bairro: "Centro",
    cep: "12345678",
    complemento: "Apto 2",
  });
  expect(legacyCheckoutAddress("unrecognized format")).toBeNull();
});
