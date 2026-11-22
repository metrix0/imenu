export function isValidFiscalCpf(value: string) {
    const digits = value.replace(/\D/g, "");
    if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;

    for (const position of [9, 10]) {
        let sum = 0;
        for (let index = 0; index < position; index++) {
            sum += Number(digits[index]) * (position + 1 - index);
        }
        if ((sum * 10 % 11) % 10 !== Number(digits[position])) return false;
    }
    return true;
}
