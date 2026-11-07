export const DEV_PAGE_SIZE = 25;

export function devPage(params: URLSearchParams, key = "page"): number {
    const value = Number(params.get(key));
    return Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 100000) : 0;
}

export function paged<T>(rows: T[], total: number, page: number, pageSize = DEV_PAGE_SIZE) {
    return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
