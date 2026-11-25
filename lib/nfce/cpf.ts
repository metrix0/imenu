export function fiscalCpf(value: unknown): string | null {
    if (typeof value !== "string" || !/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(value.trim())) return null;
    const cpf = value.replace(/\D/g, "");
    if (/^(\d)\1{10}$/.test(cpf)) return null;
    const digit = (length: number) => {
        const sum = [...cpf.slice(0, length)].reduce((total, value, index) => total + Number(value) * (length + 1 - index), 0);
        const check = (sum * 10) % 11;
        return check === 10 ? 0 : check;
    };
    return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]) ? cpf : null;
}

export function formatFiscalCpf(value: string) {
    return value.replace(/\D/g, "").slice(0, 11)
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3}\.\d{3})(\d)/, "$1.$2")
        .replace(/(\.\d{3})(\d{1,2})$/, "$1-$2");
}
