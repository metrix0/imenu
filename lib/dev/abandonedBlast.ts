import { PLUS_FEEDBACK_BLAST } from "./plusFeedbackBlast";

export const RECOVERY_DAILY_LIMIT = 20;
export const RECOVERY_COOLDOWN_DAYS = 10;
export const RECOVERY_SHARED_COOLDOWN_DAYS = 60;
export const RECOVERY_PRIORITY_LOOKBACK_DAYS = 60;

export const LEGACY_PLUS_ABANDONED_BLAST_MESSAGE = `Oi! Tudo bem? Sou o João, do iMenu 🍔

Percebi que o {{Nome Restaurante}} não tem recebido novos pedidos pelo iMenu há alguns dias.

Como tem sido sua experiência com o iMenu Plus? Se algo estiver dificultando o uso, posso te ajudar por aqui.`;

const PREVIOUS_PLUS_EXPIRY_BLAST_MESSAGE = `Oi! Tudo bem? Sou o João, do iMenu 🍔

O iMenu Plus da sua loja, {{Nome Restaurante}}, chegou ao fim. Queria entender se faltou algo ou se alguma configuração ficou difícil de colocar em prática.

Se quiser voltar ao Plus, o atendimento exclusivo pode ajudar a configurar os recursos e aplicar melhorias no seu cardápio com você. O que você gostaria de melhorar na sua loja?`;

const PRIOR_PLUS_EXPIRY_BLAST_MESSAGE = `Oi! Aqui é o João, do iMenu 🍔

Vi que o iMenu Plus da loja {{Nome Restaurante}} venceu. Se você quiser voltar, a gente pode configurar os recursos pra você pelo atendimento exclusivo do Plus.

Posso te ajudar a colocar o robô do WhatsApp no ar, ativar os avisos de pedido pros clientes ou montar sugestões de adicionais no cardápio. Qual desses você quer deixar pronto primeiro?`;

export const PLUS_ABANDONED_BLAST_MESSAGE = `Oi! Aqui é o João, do iMenu 🍔

Vi que o iMenu Plus da loja {{Nome Restaurante}} venceu! Somos gratos pelo período em que confiou em nós!

Gostaria de frisar o bônus de atendimento especial, do qual seu restaurante pode requisitar modificações e melhorias. Queria saber, há algo que podemos melhorar para trazê-los de volta ao Plus?`;

export const PLUS_EXPIRY_BLAST_MESSAGES = [
    PLUS_ABANDONED_BLAST_MESSAGE,
    PRIOR_PLUS_EXPIRY_BLAST_MESSAGE,
    PREVIOUS_PLUS_EXPIRY_BLAST_MESSAGE,
];

export const ABANDONED_BLAST_MESSAGE = `Oi! Tudo bem? Sou o João, do iMenu 🍔

Vi que você criou o cardápio da {{Nome Restaurante}} no iMenu e chegou a fazer alguns testes por lá.

Queria entender rapidinho: teve alguma coisa que te impediu de continuar usando?

Se quiser, posso te ajudar a deixar tudo funcionando certinho.`;

export const SINGLE_ORDER_DAY_RECOVERY_MESSAGE = `Oi! Tudo bem? Sou o João, do iMenu 🍔\n\nVi que o {{Nome Restaurante}} começou a receber pedidos pelo iMenu.\n\nEstá tudo funcionando direitinho? Se tiver alguma dificuldade para continuar usando, posso te ajudar.`;

export const NO_FIRST_ORDER_RECOVERY_MESSAGE = `Oi! Tudo bem? Sou o João, do iMenu 🍔\n\nVi que você concluiu o cadastro do {{Nome Restaurante}} no iMenu, mas ainda não chegou a fazer o primeiro pedido.\n\nPosso te ajudar a testar o cardápio e colocar tudo para funcionar?`;

// These activation blasts share a 60-day cooldown against all previously sent recovery blasts.
export const RECOVERY_SHARED_COOLDOWN_MESSAGES = [
    SINGLE_ORDER_DAY_RECOVERY_MESSAGE,
    NO_FIRST_ORDER_RECOVERY_MESSAGE,
];

export const CHURN_BLAST_AUTOMATIONS = {
    abandoned_plus: {
        id: "recovery-plus",
        name: "Churned iMenu Plus",
        message: PLUS_ABANDONED_BLAST_MESSAGE,
        criteria: "Plus acabou",
    },
    abandoned_imenu: {
        id: "recovery",
        name: "Churned iMenu users",
        message: ABANDONED_BLAST_MESSAGE,
        criteria: "pedidos em 2+ dias no último mês · cruzou 14 dias sem pedidos",
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

export const CHURN_BLASTS = [
    ...Object.values(CHURN_BLAST_AUTOMATIONS).map(automation => ({
        ...automation,
        sender: "blast",
        trigger: "Cron diário às 19:00 (São Paulo) · maior GMV primeiro",
        limit: RECOVERY_DAILY_LIMIT,
        sharedLimit: true,
        category: "churn" as const,
    })),
    PLUS_FEEDBACK_BLAST,
];
