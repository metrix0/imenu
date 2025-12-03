// utils/format.ts

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