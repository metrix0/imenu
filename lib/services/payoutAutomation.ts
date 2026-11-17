export const PAYOUT_RETRY_CONFIRMATION_REQUIRED = "PAYOUT_RETRY_CONFIRMATION_REQUIRED";

export const MISSING_PIX_KEY_REASON = "Chave PIX não cadastrada.";
export const MISSING_PIX_TYPE_REASON = "Tipo de PIX não cadastrado.";

export const PAYOUT_BLAST_AUTOMATIONS = {
    failed: {
        id: "payout",
        name: "Problemas com repasse",
        criteria: "Repasse com falha",
        trigger: "Envio, reenvio ou conciliação do repasse",
        message: "Não foi possível concluir seu repasse iMenu. Sua chave PIX pode estar cadastrada incorretamente. Confira e, se necessário, corrija seus dados na aba Loja do painel. Por segurança, somente você deve alterar esses dados; não envie sua chave pelo suporte.",
        limit: null,
        sender: "blast",
        category: "payouts",
    },
    "missing-key": {
        id: "payout-key",
        name: "Repasse sem chave PIX",
        criteria: "Repasse sem chave Pix cadastrada",
        trigger: "Cron de repasses ou tentativa de reenvio",
        message: "Seu repasse iMenu está pendente porque sua loja não tem uma chave PIX cadastrada. Cadastre sua chave na aba Loja do painel. Por segurança, somente você deve cadastrar ou alterar esses dados; não envie sua chave pelo suporte.",
        limit: null,
        sender: "blast",
        category: "payouts",
    },
    "missing-type": {
        id: "payout-type",
        name: "Repasse sem tipo de PIX",
        criteria: "Tipo de PIX não cadastrado",
        trigger: "Cron de repasses ou tentativa de reenvio",
        message: "Seu repasse iMenu está pendente porque o tipo da sua chave PIX não está cadastrado. Selecione o tipo da sua chave na aba Loja do painel. Por segurança, somente você deve alterar esses dados; não envie sua chave pelo suporte.",
        limit: null,
        sender: "blast",
        category: "payouts",
    },
    "preflight": {
        id: "payout-pix-warning",
        name: "Aviso preventivo de Pix",
        criteria: "Próximo repasse com chave Pix ausente, inválida ou sem tipo cadastrado",
        trigger: "Cron diário às 06:00 (São Paulo)",
        message: `Olá! Aqui é o João do iMenu! Identificamos um problema com a chave Pix do seu próximo repasse iMenu.

Poderia por gentileza, conferir se a chave e se o tipo estão corretos na aba *Loja* do painel?

Se faltar algum dado, cadastre-o nessa mesma aba. Por segurança, somente você deve alterar esses dados.

Estamos à disposição! 🧡`,
        limit: null,
        sender: "blast",
        category: "payouts",
    },
} as const;

export type PayoutNoticeKind = Exclude<keyof typeof PAYOUT_BLAST_AUTOMATIONS, "preflight">;

export function getPayoutPixProblem(row: { payment_info: string | null; payment_info_type: string | null }) {
    if (!row.payment_info?.trim()) return { kind: "missing-key", reason: MISSING_PIX_KEY_REASON } as const;
    if (!row.payment_info_type?.trim()) return { kind: "missing-type", reason: MISSING_PIX_TYPE_REASON } as const;
    return null;
}
