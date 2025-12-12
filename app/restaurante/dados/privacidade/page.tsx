"use client";

export default function PrivacidadePage() {
    return (
        <div className="max-w-3xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-4">
                Política de Privacidade – iMenu
            </h1>
            <p>Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">
                1. Dados que Coletamos
            </h2>
            <p>
                Coletamos dados de restaurantes (nome, email, telefone, senha e dados
                do cardápio), dados de clientes (nome, telefone, endereço e pedido) e
                dados automáticos como IP, cookies e analytics.
            </p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">
                2. Uso dos Dados
            </h2>
            <p>
                Utilizamos os dados para operação da plataforma, processamento de
                pedidos, análises internas e cumprimento de obrigações legais.
            </p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">
                3. Pagamentos
            </h2>
            <p>
                Pagamentos são processados pelo Mercado Pago. O iMenu não armazena
                dados financeiros e não é responsável por reembolsos.
            </p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">
                4. Compartilhamento
            </h2>
            <p>
                Dados podem ser compartilhados com restaurantes, provedores de
                hospedagem, serviços de análise e processadores de pagamento.
            </p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">
                5. Direitos do Titular (LGPD)
            </h2>
            <p>
                Você pode solicitar acesso, correção, exclusão, revogação e outras
                garantias da LGPD pelo email suporte.imenu.app@gmail.com.
            </p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">
                6. Segurança
            </h2>
            <p>
                Empregamos criptografia, HTTPS e controles internos de acesso para
                proteger informações.
            </p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">
                7. Armazenamento
            </h2>
            <p>
                Os dados são mantidos enquanto a conta estiver ativa ou quando exigido
                por lei.
            </p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">
                8. Alterações
            </h2>
            <p>Esta política pode ser atualizada periodicamente.</p>
        </div>
    );
}
