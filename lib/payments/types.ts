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
    addressComplement?: string;
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

export function getCreditCardPaymentDataError(
    card: CreditCardPaymentData
): string | null {
    const cardNumber = digits(card.number);
    const ccv = digits(card.ccv);
    const cpfCnpj = digits(card.cpfCnpj);
    const postalCode = digits(card.postalCode);
    const mobilePhone = digits(card.mobilePhone);
    const expiry = card.expiry.trim().match(/^(\d{2})\/(\d{2}|\d{4})$/);
    const month = expiry ? Number(expiry[1]) : 0;

    if (cardNumber.length < 13 || cardNumber.length > 19) {
        return "Confira o número do cartão.";
    }
    if (card.holderName.trim().length < 2) {
        return "Confira o nome no cartão.";
    }
    if (!expiry || month < 1 || month > 12) {
        return "Confira a validade do cartão (MM/AA ou MM/AAAA).";
    }
    if (ccv.length < 3 || ccv.length > 4) {
        return "Confira o CVV do cartão.";
    }
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
        return "Confira o CPF/CNPJ do titular.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(card.email.trim())) {
        return "Confira o e-mail do titular.";
    }
    if (postalCode.length !== 8) {
        return "Confira o CEP.";
    }
    if (!card.addressNumber.trim()) {
        return "Confira o número do endereço.";
    }
    if (mobilePhone.length !== 10 && mobilePhone.length !== 11) {
        return "Confira o celular do titular.";
    }

    return null;
}

export function isCreditCardPaymentDataComplete(
    card: CreditCardPaymentData
): boolean {
    return getCreditCardPaymentDataError(card) === null;
}
