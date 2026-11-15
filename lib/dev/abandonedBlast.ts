export const RECOVERY_DAILY_LIMIT = 20;

export const PLUS_ABANDONED_BLAST_MESSAGE = `Oi! Tudo bem? Sou o João, do iMenu 🍔

Percebi que o {{Nome Restaurante}} não tem recebido novos pedidos pelo iMenu há alguns dias.

Como tem sido sua experiência com o iMenu Plus? Se algo estiver dificultando o uso, posso te ajudar por aqui.`;

export const ABANDONED_BLAST_MESSAGE = `Oi! Tudo bem? Sou o João, do iMenu 🍔

Vi que você criou o cardápio da {{Nome Restaurante}} no iMenu e chegou a fazer alguns testes por lá.

Queria entender rapidinho: teve alguma coisa que te impediu de continuar usando?

Se quiser, posso te ajudar a deixar tudo funcionando certinho.`;

export const SINGLE_ORDER_DAY_RECOVERY_MESSAGE = `Oi! Tudo bem? Sou o João, do iMenu 🍔\n\nVi que o {{Nome Restaurante}} começou a receber pedidos pelo iMenu.\n\nEstá tudo funcionando direitinho? Se tiver alguma dificuldade para continuar usando, posso te ajudar.`;

export const NO_FIRST_ORDER_RECOVERY_MESSAGE = `Oi! Tudo bem? Sou o João, do iMenu 🍔\n\nVi que você concluiu o cadastro do {{Nome Restaurante}} no iMenu, mas ainda não chegou a fazer o primeiro pedido.\n\nPosso te ajudar a testar o cardápio e colocar tudo para funcionar?`;

export const CHURN_BLAST_AUTOMATIONS = {
    abandoned_plus: {
        id: "recovery-plus",
        name: "Churned iMenu Plus",
        message: PLUS_ABANDONED_BLAST_MESSAGE,
        criteria: "Plus ativo · pedidos em 2+ dias no último mês · cruzou 14 dias sem pedidos",
    },
    abandoned_imenu: {
        id: "recovery",
        name: "Churned iMenu users",
        message: ABANDONED_BLAST_MESSAGE,
        criteria: "iMenu sem Plus · pedidos em 2+ dias no último mês · cruzou 14 dias sem pedidos",
    },
    single_day: {
        id: "single-order",
        name: "Um único dia de pedidos",
        message: SINGLE_ORDER_DAY_RECOVERY_MESSAGE,
        criteria: "Cadastro completo · pedidos em apenas 1 dia nos últimos 14 dias",
    },
    no_first_order: {
        id: "first-order",
        name: "Não ativados",
        message: NO_FIRST_ORDER_RECOVERY_MESSAGE,
        criteria: "Cadastro completo há 24–48h · ainda sem primeiro pedido",
    },
} as const;

export const CHURN_BLASTS = Object.values(CHURN_BLAST_AUTOMATIONS).map(automation => ({
    ...automation,
    sender: "blast",
    trigger: "Cron diário às 19:00 (São Paulo) · maior GMV primeiro",
    limit: RECOVERY_DAILY_LIMIT,
    category: "churn" as const,
}));
