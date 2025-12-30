// utils/format.ts

import {Subcategory, Subitem, Item} from "@/lib/types/types";

export const formatPrice = (cents: number): string => {
    return (cents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
};

export const formatPriceNoRS = (cents: number) =>
    (cents / 100)
        .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        .replace("R$", "")
        .trim();


export const promotionPrice = (item: any, multiplyQty: boolean = true) => {

    if(!item.promotion || item.promotion.value <= 0 || !item.promotion.type) return

    let itemPrice = item.unit_price_cents || item.price_cents
    if(item.qty && multiplyQty) itemPrice = itemPrice * item.qty
    if(item.promotion.type === "percent"){
        return Math.round(itemPrice*(1-item.promotion.value/100))
    }
    else if(item.promotion.type === "fixed"){
        return itemPrice-item.promotion.value
    }

}