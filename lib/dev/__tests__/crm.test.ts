import { query } from "@/lib/database/sql";
import { getCrm } from "../crm";
import { getTodayRecoveryForecast } from "../abandonedBlastPlan";
import { PLUS_FIRST_MONTH_FEEDBACK_MESSAGE } from "../plusFeedbackBlast";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("../abandonedBlastPlan", () => ({
    ...jest.requireActual("../abandonedBlastPlan"),
    getTodayRecoveryForecast: jest.fn().mockResolvedValue(null),
}));
const sqlQuery = query as jest.Mock;

beforeEach(() => {
    sqlQuery.mockReset();
    sqlQuery
        .mockResolvedValueOnce({ rows: [{ id: "r-1", name: "A", gmv_cents: "123456" }] })
        .mockResolvedValueOnce({ rows: [{ total: 35 }] });
});

test("CRM list returns lifetime GMV using the same eligible order statuses as the profile", async () => {
    const data = await getCrm(new URLSearchParams("page=0"));
    expect("rows" in data && data.rows[0]?.gmv_cents).toBe("123456");
    const [sql] = sqlQuery.mock.calls[0];
    expect(sql).toContain("LEFT JOIN LATERAL");
    expect(sql).toContain("SUM(o.total_cents)");
    expect(sql).toContain("o.restaurant_id=r.id");
    expect(sql).toContain("o.status IS DISTINCT FROM 'canceled'");
    expect(sql).toContain("o.status IS DISTINCT FROM 'pending_online_payment'");
    expect(sql).toContain("ORDER BY r.created_at DESC,r.id LIMIT $2 OFFSET $3");
});

test.each([
    ["name", "asc", "LOWER(r.name) ASC NULLS LAST, r.id"],
    ["gmv", "desc", "gmv.gmv_cents DESC NULLS LAST, r.id"],
    ["gmv", "asc", "gmv.gmv_cents ASC NULLS LAST, r.id"],
    ["created", "desc", "r.created_at DESC NULLS LAST, r.id"],
    ["owner", "asc", "COALESCE(NULLIF(BTRIM(u.raw_user_meta_data->>'phone'), ''), NULLIF(BTRIM(r.phone), '')) ASC NULLS LAST, r.id"],
    ["store", "asc", "NULLIF(BTRIM(r.store_whatsapp), '') ASC NULLS LAST, r.id"],
])("sort %s %s is applied in SQL before pagination", async (sort, direction, expected) => {
    await getCrm(new URLSearchParams({ sort, direction, page: "2" }));
    const [sql, params] = sqlQuery.mock.calls[0];
    expect(sql).toContain("ORDER BY " + expected + " LIMIT $2 OFFSET $3");
    expect(params).toEqual(["", 10, 20]);
});

test("sorting by customer tier uses Plus > historically paid > free", async () => {
    await getCrm(new URLSearchParams({ sort: "status", direction: "desc", paid: "1" }));
    const [sql] = sqlQuery.mock.calls[0];
    expect(sql).toContain("ORDER BY CASE WHEN (");
    expect(sql).toContain("THEN 2 WHEN (");
    expect(sql).toContain("THEN 1 ELSE 0 END DESC NULLS LAST, r.id");
});

test("unrecognized sort input cannot become executable SQL", async () => {
    await getCrm(new URLSearchParams({ sort: "gmv;DROP TABLE orders", direction: "asc" }));
    const [sql] = sqlQuery.mock.calls[0];
    expect(sql).not.toContain("DROP TABLE");
    expect(sql).toContain("ORDER BY r.created_at DESC,r.id");
});

test("paid CRM list uses creation date by default", async () => {
    await getCrm(new URLSearchParams({ paid: "1" }));
    const [sql] = sqlQuery.mock.calls[0];
    expect(sql).toContain("ORDER BY r.created_at DESC,r.id");
});

test.each([
    ["active", ["o.status='done'", "COUNT(DISTINCT", "INTERVAL '14 days'"]],
    ["active_customers", ["o.customer_phone", "COUNT(DISTINCT normalized.phone)", "INTERVAL '30 days'"]],
    ["abandoned_plus", ["MAX(o.created_at)", "INTERVAL '15 days'", "addon.product_key = 'ia_plus'"]],
    ["abandoned_imenu", ["MAX(o.created_at)", "INTERVAL '15 days'", "AND NOT "]],
    ["single_day", ["owned.creation_step>=4", "owned.first_time=false", "GROUP BY owned.id, "]],
    ["no_first_order", ["owned.onboarding_completed_at", "INTERVAL '48 hours'", "INTERVAL '24 hours'", "NOT EXISTS"]],
])("CRM activity %s filters data and total before pagination", async (activity, parts) => {
    await getCrm(new URLSearchParams({ activity, page: "2", sort: "gmv", direction: "desc" }));
    const [listSql, params] = sqlQuery.mock.calls[0];
    const [countSql] = sqlQuery.mock.calls[1];
    for (const part of parts) {
        expect(listSql).toContain(part);
        expect(countSql).toContain(part);
    }
    expect(listSql).toContain("ORDER BY gmv.gmv_cents DESC NULLS LAST, r.id LIMIT $2 OFFSET $3");
    expect(params).toEqual(["", 10, 20]);
});

test("invalid activity values are ignored (cannot inject SQL)", async () => {
    await getCrm(new URLSearchParams({ activity: "x' OR true --" }));
    const [sql] = sqlQuery.mock.calls[0];
    expect(sql).not.toContain("x' OR true --");
    expect(sql).not.toContain("COUNT(DISTINCT normalized.phone)");
});

test("legacy Cadastro query parameter no longer affects filtering", async () => {
    await getCrm(new URLSearchParams({ age: "30" }));
    const [sql] = sqlQuery.mock.calls[0];
    expect(sql).not.toContain("r.created_at >= NOW() - INTERVAL '30 days'");
});

test("last support message uses the visible real conversation and sorts by message date", async () => {
    await getCrm(new URLSearchParams({ sort: "last_message", direction: "desc" }));
    const [sql] = sqlQuery.mock.calls[0];
    expect(sql).toContain("support.conversation_id AS support_conversation_id");
    expect(sql).toContain("support.last_message");
    expect(sql).toContain("support.last_message_at DESC NULLS LAST");
    expect(sql).toContain("c.restaurant_id=r.id");
    expect(sql).toContain("c.chat_id NOT LIKE 'imenu-blast:%'");
    expect(sql).toContain("sm.direction='inbound' OR sm.send_status='sent'");
    expect(sql).toContain("support_contact_exclusions");
});

test("restaurant profile includes the same support conversation lookup", async () => {
    sqlQuery.mockReset()
        .mockResolvedValueOnce({ rows: [{ id: "profile" }] })
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [] });
    const id = "00000000-0000-0000-0000-000000000001";
    await getCrm(new URLSearchParams({ restaurant_id: id }));
    const [sql, params] = sqlQuery.mock.calls[0];
    expect(sql).toContain("support.conversation_id AS support_conversation_id");
    expect(sql).toContain("support.mode AS support_mode");
    expect(sql).toContain("c.restaurant_id=r.id");
    expect(params).toEqual([id]);
});

test.each([
    ["churned_plus", "addon.current_period_ends_at >= bounds.start_at", "addon.current_period_ends_at AS event_at"],
    ["churned_imenu", "last_order_at + INTERVAL '14 days' AS churned_at", "churned_at AS event_at"],
    ["not_activated", "owned.onboarding_completed_at >= bounds.start_at", "owned.onboarding_completed_at AS event_at"],
])("Churn %s filters by the selected range and sorts by event before pagination", async (activity, predicate, eventDate) => {
    await getCrm(new URLSearchParams({
        activity, startDate: "2026-11-09", endDate: "2026-11-15", page: "2",
    }));
    const [[listSql, listArgs], [countSql, countArgs]] = sqlQuery.mock.calls;
    expect(listSql).toContain(predicate);
    expect(countSql).toContain(predicate);
    expect(listSql).toContain(eventDate);
    expect(listSql).toContain("ORDER BY churn.event_at DESC, r.id LIMIT $4 OFFSET $5");
    expect(listArgs).toEqual(["", "2026-11-09", "2026-11-15", 10, 20]);
    expect(countArgs).toEqual(["", "2026-11-09", "2026-11-15"]);
});

test("the single-day cohort ignores the selected date range", async () => {
    await getCrm(new URLSearchParams({
        activity: "single_day", includeBlast: "1", startDate: "2026-11-09", endDate: "2026-11-15",
    }));
    const [[sql, args]] = sqlQuery.mock.calls;
    expect(sql).toContain("INTERVAL '14 days'");
    expect(sql).not.toContain("churn_bounds");
    expect(sql).toContain("MAX(o.created_at) AS event_at");
    expect(sql).toContain("ORDER BY churn.event_at DESC, r.id LIMIT $2 OFFSET $3");
    expect(args.slice(0, 3)).toEqual(["", 10, 0]);
});

test("explicit column sorting overrides the Churn default", async () => {
    await getCrm(new URLSearchParams({ activity: "single_day", includeBlast: "1", sort: "gmv", direction: "asc" }));
    expect(sqlQuery.mock.calls[0][0]).toContain("ORDER BY gmv.gmv_cents ASC NULLS LAST, r.id LIMIT $2 OFFSET $3");
});

test("invalid dates never reach the SQL query", async () => {
    const result = await getCrm(new URLSearchParams({
        activity: "churned_plus", startDate: "2026-02-30", endDate: "2026-03-07",
    }));
    expect(result).toMatchObject({ rows: [], total: 0 });
    expect(sqlQuery).not.toHaveBeenCalled();
});

test.each([
    ["churned_plus", "iMenu Plus da loja"],
    ["churned_imenu", "alguns testes por lá"],
    ["single_day", "começou a receber pedidos"],
    ["not_activated", "primeiro pedido"],
])("Churn %s includes the corresponding blast history only in the paginated result", async (activity, message) => {
    const hasPeriod = activity !== "single_day";
    await getCrm(new URLSearchParams({
        activity, includeBlast: "1", startDate: "2026-11-09", endDate: "2026-11-15",
    }));
    const [[listSql, listArgs], [countSql, countArgs]] = sqlQuery.mock.calls;
    expect(listSql).toContain("churn_blast.status AS blast_status");
    expect(listSql).toContain("campaign.status IN ('running', 'paused')");
    expect(listSql).toContain("recipient.status IN ('sent', 'failed', 'cancelled', 'skipped_60d', 'skipped_recent', 'skipped_reactivated')");
    expect(listSql).toContain("WHEN recipient.status = 'pending' AND campaign.status = 'paused' THEN 'paused'");
    expect(listSql).toContain("ELSE recipient.attempted_at");
    expect(listSql).toContain("churn_blast.error AS blast_error");
    expect(listSql).toContain(`regexp_replace(BTRIM(campaign.message), '\\s+', ' ', 'g') = ANY($${hasPeriod ? 6 : 4}::text[])`);
    expect(listSql).toContain(`regexp_replace(BTRIM(message.body), '\\s+', ' ', 'g') ~ ANY($${hasPeriod ? 7 : 5}::text[])`);
    const feedback = activity === "churned_plus";
    expect(listArgs).toHaveLength((hasPeriod ? 7 : 5) + Number(feedback));
    const [templates, patterns] = listArgs.slice(hasPeriod ? 5 : 3);
    const expectedCopy = feedback ? [message, "atendimento exclusivo", "chegou ao fim"] : [message];
    for (const copy of expectedCopy) {
        expect(templates).toContainEqual(expect.stringContaining(copy));
        expect(patterns).toContainEqual(expect.stringContaining(copy));
    }
    expect(templates).toHaveLength(expectedCopy.length);
    expect(patterns).toHaveLength(expectedCopy.length);
    if (feedback) {
        expect(listArgs.at(-1)).toBe(PLUS_FIRST_MONTH_FEEDBACK_MESSAGE);
        expect(listSql).toContain("feedback_blast.status AS feedback_blast_status");
        expect(listSql).toContain("campaign.sender = 'support' AND campaign.message = $8");
        expect(listSql).toContain("(churn.event_at AT TIME ZONE 'America/Sao_Paulo')::date - 7");
        expect(listSql).toContain("'support:bulk:support:'");
    } else {
        expect(listSql).not.toContain("feedback_blast");
    }
    expect(listSql).toContain("ORDER BY sort_at DESC NULLS LAST");
    expect(countSql).not.toContain("support_blast_recipients");
    expect(countArgs).toHaveLength(hasPeriod ? 3 : 1);
});

test("Churn displays a forecast without replacing today's confirmed delivery status", async () => {
    (getTodayRecoveryForecast as jest.Mock).mockResolvedValueOnce({
        day: "2026-11-15", accounts: new Set(["account-a", "account-b"]),
    });
    sqlQuery.mockReset()
        .mockResolvedValueOnce({ rows: [
            { id: "a", blast_account_id: "account-a", blast_status: null, feedback_blast_status: "sent" },
            { id: "b", blast_account_id: "account-b", blast_status: "sent", blast_at: "2026-11-15T18:00:00Z" },
            { id: "c", blast_account_id: "account-c", blast_status: null },
        ] })
        .mockResolvedValueOnce({ rows: [{ total: 3 }] });
    const page = await getCrm(new URLSearchParams({
        activity: "churned_plus", includeBlast: "1", startDate: "2026-11-09", endDate: "2026-11-15",
    }));
    expect(page).toMatchObject({ rows: [
        { id: "a", blast_status: "predicted", feedback_blast_status: "sent" },
        { id: "b", blast_status: "sent" },
        { id: "c", blast_status: null },
    ] });
    expect("rows" in page && page.rows[0]).not.toHaveProperty("blast_account_id");
});

test("regular CRM results do not include recovery blast history", async () => {
    await getCrm(new URLSearchParams({ activity: "single_day" }));
    expect(sqlQuery.mock.calls[0][0]).not.toContain("churn_blast");
    expect(sqlQuery.mock.calls[0][0]).toContain("ORDER BY r.created_at DESC,r.id LIMIT $2 OFFSET $3");
});
