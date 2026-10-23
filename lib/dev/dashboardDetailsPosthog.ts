import { getPostHogConfig, runPostHogQuery } from "@/lib/analytics/posthogQuery";
import { CONSUMER_EVENTS } from "@/lib/analytics/consumerEvents";

export async function loadTrafficSummary(
    startAt: number,
    endAt: number
): Promise<{ appViews: number | null; landingViews: number | null }> {
    if (!getPostHogConfig()) {
        return { appViews: null, landingViews: null };
    }

    const start = new Date(startAt).toISOString();
    const end = new Date(endAt).toISOString();
    const hogql = `
        SELECT
            countIf(
                event = '$pageview'
                AND (
                    properties.$pathname = '/blog'
                    OR startsWith(toString(properties.$pathname), '/blog/')
                    OR properties.$pathname = '/ferramentas'
                    OR startsWith(toString(properties.$pathname), '/ferramentas/')
                    OR properties.$pathname = '/cardapio-digital'
                    OR properties.$pathname = '/cardapio-digital-gratuito'
                    OR properties.$pathname = '/gestor-de-pedidos'
                    OR properties.$pathname = '/goomer'
                    OR properties.$pathname = '/anota-ai'
                    OR properties.$pathname = '/saipos'
                    OR properties.$pathname = '/restaurantes'
                    OR startsWith(toString(properties.$pathname), '/restaurantes/')
                    OR properties.$pathname = '/restaurante'
                    OR startsWith(toString(properties.$pathname), '/restaurante/')
                )
            ) AS app_views,
            countIf(
                event = '$pageview'
                AND properties.$pathname = '/'
            ) AS landing_views
        FROM events
        WHERE timestamp >= parseDateTimeBestEffort('${start}')
          AND timestamp < parseDateTimeBestEffort('${end}')
    `;

    try {
        const row = (await runPostHogQuery(hogql))[0];
        if (!row) throw new Error("PostHog returned no result row.");

        return {
            appViews: Number(row[0]) || 0,
            landingViews: Number(row[1]) || 0,
        };
    } catch (error) {
        console.warn("[DEV_DASHBOARD_DETAILS] PostHog unavailable:", error);
        return { appViews: null, landingViews: null };
    }
}

export async function loadFunnelSummary(
    startAt: number,
    endAt: number
): Promise<{
    registrationComplete: number | null;
    step1Views: number | null;
    step2Views: number | null;
    step3Views: number | null;
    step4Views: number | null;
    orderedConsumers: number | null;
}> {
    if (!getPostHogConfig()) {
        return {
            registrationComplete: null,
            step1Views: null,
            step2Views: null,
            step3Views: null,
            step4Views: null,
            orderedConsumers: null,
        };
    }

    const start = new Date(startAt).toISOString();
    const end = new Date(endAt).toISOString();
    const orderPathRegex =
        '^/[^/]+/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
    const legacyOrderPathRegex =
        '^/pedido/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
    const onboardingHogql = `
        SELECT
            countIf(
                event = '$pageview'
                AND properties.$pathname = '/restaurante/criar/cardapio'
            ),
            countIf(
                event = '$pageview'
                AND properties.$pathname = '/restaurante/criar/disponibilidade'
            ),
            countIf(
                event = '$pageview'
                AND properties.$pathname = '/restaurante/criar/loja'
            ),
            countIf(
                event = '$pageview'
                AND properties.$pathname = '/restaurante/criar/localizacao'
            )
        FROM events
        WHERE timestamp >= parseDateTimeBestEffort('${start}')
          AND timestamp < parseDateTimeBestEffort('${end}')
    `;
    const orderedHogql = `
        SELECT count()
        FROM (
            SELECT distinct_id
            FROM events
            WHERE timestamp >= parseDateTimeBestEffort('${start}')
              AND timestamp < parseDateTimeBestEffort('${end}')
              AND event IN (
                  '$pageview',
                  '${CONSUMER_EVENTS.paymentStarted}'
              )
            GROUP BY distinct_id
            HAVING countIf(
                event = '${CONSUMER_EVENTS.paymentStarted}'
            ) > 0
              AND countIf(
                    event = '$pageview'
                    AND (
                        match(toString(properties.$pathname), '${orderPathRegex}')
                        OR match(toString(properties.$pathname), '${legacyOrderPathRegex}')
                    )
              ) > 0
        )
    `;

    try {
        const [onboardingRows, orderedRows] = await Promise.all([
            runPostHogQuery(onboardingHogql),
            runPostHogQuery(orderedHogql),
        ]);
        const onboardingRow = onboardingRows[0];
        if (!onboardingRow) throw new Error("PostHog returned no onboarding result row.");

        const step1Views = Number(onboardingRow[0]) || 0;
        return {
            registrationComplete: step1Views,
            step1Views,
            step2Views: Number(onboardingRow[1]) || 0,
            step3Views: Number(onboardingRow[2]) || 0,
            step4Views: Number(onboardingRow[3]) || 0,
            orderedConsumers: Number(orderedRows[0]?.[0]) || 0,
        };
    } catch (error) {
        console.warn("[DEV_DASHBOARD_DETAILS] Funnel metrics unavailable:", error);
        return {
            registrationComplete: null,
            step1Views: null,
            step2Views: null,
            step3Views: null,
            step4Views: null,
            orderedConsumers: null,
        };
    }
}

export async function loadQrTableFunnelSummary(
    startAt: number,
    endAt: number
): Promise<{
    onboardingViewed: number | null;
    onboardingSelected: number | null;
    onboardingLearnMore: number | null;
    managementViewed: number | null;
    managementLearnMore: number | null;
}> {
    if (!getPostHogConfig()) {
        return {
            onboardingViewed: null,
            onboardingSelected: null,
            onboardingLearnMore: null,
            managementViewed: null,
            managementLearnMore: null,
        };
    }

    const start = new Date(startAt).toISOString();
    const end = new Date(endAt).toISOString();
    const hogql = `
        SELECT
            uniqIf(distinct_id, event = 'qr_code_mesa_onboarding_viewed'),
            uniqIf(distinct_id, event = 'qr_code_mesa_onboarding_selected'),
            uniqIf(
                distinct_id,
                event = 'qr_code_mesa_learn_more_viewed'
                AND properties.source = 'onboarding'
            ),
            uniqIf(
                distinct_id,
                event IN (
                    'qr_code_mesa_page_viewed',
                    'qr_code_mesa_settings_viewed'
                )
            ),
            uniqIf(
                distinct_id,
                event = 'qr_code_mesa_learn_more_viewed'
                AND properties.source IN ('mesas', 'settings')
            )
        FROM events
        WHERE timestamp >= parseDateTimeBestEffort('${start}')
          AND timestamp < parseDateTimeBestEffort('${end}')
    `;

    try {
        const row = (await runPostHogQuery(hogql))[0];
        if (!row) throw new Error("PostHog returned no result row.");

        return {
            onboardingViewed: Number(row[0]) || 0,
            onboardingSelected: Number(row[1]) || 0,
            onboardingLearnMore: Number(row[2]) || 0,
            managementViewed: Number(row[3]) || 0,
            managementLearnMore: Number(row[4]) || 0,
        };
    } catch (error) {
        console.warn(
            "[DEV_DASHBOARD_DETAILS] QR Code Mesa funnel unavailable:",
            error
        );
        return {
            onboardingViewed: null,
            onboardingSelected: null,
            onboardingLearnMore: null,
            managementViewed: null,
            managementLearnMore: null,
        };
    }
}
