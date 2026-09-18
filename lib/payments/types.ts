export type OnlinePaymentMethod = "pix" | "credit_card";

export type CreditCardPaymentData = {
    number: string;
    holderName: string;
    expiry: string;
    ccv: string;
    cpfCnpj: string;
    email: string;
    postalCode: string;
    addressNumber: string;
    addressComplement: string;
    mobilePhone: string;
};

export type PaymentCheckoutInput =
    | { method: "pix" }
    | { method: "credit_card"; card: CreditCardPaymentData };

export const EMPTY_CREDIT_CARD_PAYMENT_DATA: CreditCardPaymentData = {
    number: "",
    holderName: "",
    expiry: "",
    ccv: "",
    cpfCnpj: "",
    email: "",
    postalCode: "",
    addressNumber: "",
    addressComplement: "",
    mobilePhone: "",
};

function digits(value: string): string {
    return value.replace(/\D/g, "");
}

export function isCreditCardPaymentDataComplete(
    card: CreditCardPaymentData
): boolean {
    const cardNumber = digits(card.number);
    const ccv = digits(card.ccv);
    const cpfCnpj = digits(card.cpfCnpj);
    const postalCode = digits(card.postalCode);
    const mobilePhone = digits(card.mobilePhone);
    const expiry = card.expiry.trim().match(/^(\d{2})\/(\d{4})$/);
    const month = expiry ? Number(expiry[1]) : 0;

    return (
        cardNumber.length >= 13 &&
        cardNumber.length <= 19 &&
        card.holderName.trim().length >= 2 &&
        Boolean(expiry) &&
        month >= 1 &&
        month <= 12 &&
        ccv.length >= 3 &&
        ccv.length <= 4 &&
        (cpfCnpj.length === 11 || cpfCnpj.length === 14) &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(card.email.trim()) &&
        postalCode.length === 8 &&
        card.addressNumber.trim().length > 0 &&
        (mobilePhone.length === 10 || mobilePhone.length === 11)
    );
}
