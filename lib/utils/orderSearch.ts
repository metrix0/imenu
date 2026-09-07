/** Quote PostgREST filter values so punctuation cannot become filter syntax. */
export function orderSearchFilter(search: string): string {
    const term = search.trim();
    if (!term) return "";
    const pattern = JSON.stringify(`%${term.replace(/[\\%_*]/g, "\\$&")}%`);
    const filters = [`customer_name.ilike.${pattern}`, `customer_address.ilike.${pattern}`];
    const number = term.replace(/^#/, "");
    if (/^\d+$/.test(number) && BigInt(number) <= BigInt("9223372036854775807")) filters.unshift(`display_id.eq.${number}`);
    return filters.join(",");
}
