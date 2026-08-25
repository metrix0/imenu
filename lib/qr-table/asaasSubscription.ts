import type { QrTableAddon } from "@/lib/qr-table/types";
import { asaasRequest } from "@/lib/services/asaas";

type AsaasSubscription = {
    id?: string;
    dateCreated?: string;
    value?: number;
    nextDueDate?: string;
    cycle?: string;
    billingType?: string;
    status?: string;
    externalReference?: string | null;
    deleted?: boolean;
};

type SubscriptionListResponse = {
    data?: AsaasSubscription[];
};

type ResolveOptions = {
    customerId?: string | null;
    nextDueDate?: string | null;
};

const MAX_CREATED_AT_DISTANCE_MS = 2 * 24 * 60 * 60 * 1000;

function datePart(value: string | null | undefined): string {
    return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "";
}

function subscriptionIdWhenUnique(
    subscriptions: AsaasSubscription[]
): string | null {
    const ids = subscriptions
        .map((subscription) => subscription.id || "")
        .filter(Boolean);
    return ids.length === 1 ? ids[0] : null;
}

export async function resolveAsaasSubscriptionId(
    addon: QrTableAddon,
    options: ResolveOptions = {}
): Promise<string | null> {
    if (addon.asaas_subscription_id) return addon.asaas_subscription_id;

    const exact = await asaasRequest<SubscriptionListResponse>(
        `/subscriptions?externalReference=${encodeURIComponent(
            addon.id
        )}&status=ACTIVE&limit=100`
    );
    const exactId = subscriptionIdWhenUnique(
        (exact.data || []).filter((subscription) => !subscription.deleted)
    );
    if (exactId) return exactId;

    const params = new URLSearchParams({
        status: "ACTIVE",
        billingType: "CREDIT_CARD",
        limit: "100",
        sort: "dateCreated",
        order: "desc",
    });
    if (options.customerId) params.set("customer", options.customerId);

    const response = await asaasRequest<SubscriptionListResponse>(
        `/subscriptions?${params.toString()}`
    );

    let candidates = (response.data || []).filter(
        (subscription) =>
            Boolean(subscription.id) &&
            !subscription.deleted &&
            subscription.status === "ACTIVE" &&
            subscription.billingType === "CREDIT_CARD" &&
            subscription.cycle === "MONTHLY" &&
            Math.round((Number(subscription.value) || 0) * 100) ===
                addon.price_cents
    );

    const directMatch = subscriptionIdWhenUnique(candidates);
    if (directMatch) return directMatch;

    const expectedDueDate =
        datePart(options.nextDueDate) || datePart(addon.current_period_ends_at);
    if (expectedDueDate) {
        const dueDateMatches = candidates.filter(
            (subscription) =>
                datePart(subscription.nextDueDate) === expectedDueDate
        );
        const dueDateMatch = subscriptionIdWhenUnique(dueDateMatches);
        if (dueDateMatch) return dueDateMatch;
        if (dueDateMatches.length > 0) candidates = dueDateMatches;
    }

    const activatedAt = addon.activated_at
        ? new Date(addon.activated_at).getTime()
        : Number.NaN;
    if (Number.isFinite(activatedAt)) {
        const createdAtMatches = candidates.filter((subscription) => {
            const createdAt = subscription.dateCreated
                ? new Date(subscription.dateCreated).getTime()
                : Number.NaN;
            return (
                Number.isFinite(createdAt) &&
                Math.abs(createdAt - activatedAt) <= MAX_CREATED_AT_DISTANCE_MS
            );
        });
        const createdAtMatch = subscriptionIdWhenUnique(createdAtMatches);
        if (createdAtMatch) return createdAtMatch;
    }

    return null;
}
