import { Item, Promotion } from "@/lib/types/types";

export function mergePromotions(
    items: Item[],
    promotions: Promotion[]
): Item[] {
    const promoMap = new Map<string, Promotion>();

    promotions.forEach(p => {
        promoMap.set(p.item_id, p);
    });

    return items.map(item => ({
        ...item,
        promotion: promoMap.get(item.id)
    }));
}
