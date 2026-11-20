export const PLUS_FEEDBACK_DAILY_LIMIT = 5;

export const PLUS_FIRST_MONTH_FEEDBACK_MESSAGE = `Oi! Tudo bem? Sou o João, do iMenu 🍔

O {{Nome Restaurante}} adquiriu o Plus há algumas semanas, agradecemos a confiança! Queria saber como tem sido sua experiência até agora.

Tem algo em que possamos ajudar ou melhorar? Pode me contar por aqui! 🙂`;

export const PLUS_FEEDBACK_BLAST = {
    id: "plus-feedback",
    name: "7d Blast · Feedback do 1º mês Plus",
    sender: "support",
    message: PLUS_FIRST_MONTH_FEEDBACK_MESSAGE,
    criteria: "Pede feedback 7 dias antes do vencimento ou da primeira renovação do Plus · Pix primeiro",
    trigger: "Cron diário às 19:00 (São Paulo)",
    limit: PLUS_FEEDBACK_DAILY_LIMIT,
    category: "churn",
} as const;
