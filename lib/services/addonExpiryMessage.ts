function productName(productKey: string): string {
    if (productKey === "ia_plus") return "iMenu Plus";
    const uppercaseWords = new Set(["qr", "ai", "api"]);

    return productKey
        .split("_")
        .filter(Boolean)
        .map((word) =>
            uppercaseWords.has(word.toLowerCase())
                ? word.toUpperCase()
                : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");
}

export type ReminderProducts = { pix: string[]; card: string[] };

export function buildExpiryMessage(products: ReminderProducts): string {
    const pixNames = products.pix.map(productName);
    const cardNames = products.card.map(productName);
    const lines = ["Olá! 👋", ""];

    if (pixNames.length) {
        lines.push(
            pixNames.length > 1
                ? "O período dos seus adicionais abaixo termina hoje:"
                : "O período do seu adicional *" + pixNames[0] + "* termina hoje."
        );
        if (pixNames.length > 1) {
            lines.push(...pixNames.map((name) => "• *" + name + "*"));
        }
        lines.push(
            "",
            "A renovação via Pix não é automática. Você tem *1 dia de tolerância* para renovar sem perder acesso."
        );
    }

    if (cardNames.length) {
        if (pixNames.length) lines.push("");
        lines.push(
            cardNames.length > 1
                ? "As assinaturas dos adicionais abaixo foram canceladas:"
                : "A assinatura do seu adicional *" + cardNames[0] + "* foi cancelada."
        );
        if (cardNames.length > 1) {
            lines.push(...cardNames.map((name) => "• *" + name + "*"));
        }
        lines.push(
            "",
            "O acesso vence amanhã e não haverá renovação automática no cartão."
        );
    }

    lines.push(
        "",
        "Acesse a aba Configurações no iMenu para renovar e continuar usando os recursos. imenuapp.com.br/painel/configuracoes",
        "",
        "Fico à disposição caso precise de ajuda!"
    );
    return lines.join("\n");
}

