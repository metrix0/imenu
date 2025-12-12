"use client";

export default function TermosPage() {
    return (
        <div className="max-w-3xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-4">Termos de Uso – iMenu</h1>
            <p>Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">1. Sobre o Serviço</h2>
            <p>
                O iMenu é uma plataforma digital que permite que restaurantes criem e
                personalizem seus cardápios digitais, recebam pedidos e atualizem seus
                status. O iMenu não é responsável pela qualidade da comida, preparo,
                entrega, preços, informações ou disponibilidade de itens.
            </p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">
                2. Cadastro e Acesso do Restaurante
            </h2>
            <p>
                Restaurantes devem fornecer nome, email, telefone e senha. O usuário é
                responsável por manter suas credenciais em segurança e por todas as
                informações inseridas.
            </p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">
                3. Uso do Serviço pelos Clientes
            </h2>
            <p>
                Clientes não criam conta, mas podem fornecer nome, telefone, endereço e
                dados do pedido. O restaurante é o único responsável pelo atendimento.
            </p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">
                4. Pedidos e Pagamentos
            </h2>
            <p>
                Pagamentos realizados via Mercado Pago são processados diretamente por
                eles. O iMenu não armazena dados de cartão e não é responsável por
                reembolsos, disputas ou valores retidos.
            </p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">
                5. Responsabilidades do Usuário
            </h2>
            <p>
                O restaurante concorda em não usar o serviço para fins ilegais, manter
                dados atualizados e garantir a veracidade das informações do cardápio.
            </p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">
                6. Limitações de Responsabilidade
            </h2>
            <p>
                O iMenu não se responsabiliza por indisponibilidade do serviço, falhas
                de terceiros, erros de internet ou danos decorrentes do uso da
                plataforma.
            </p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">
                7. Conteúdo do Restaurante
            </h2>
            <p>
                O restaurante é responsável por fotos, descrições e informações
                publicadas.
            </p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">
                8. Privacidade
            </h2>
            <p>
                O uso do serviço implica concordância com nossa Política de Privacidade
                disponível em /privacidade.
            </p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">
                9. Encerramento
            </h2>
            <p>Podemos suspender o acesso em caso de violação dos termos.</p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">
                10. Alterações
            </h2>
            <p>Estes termos podem ser alterados sem aviso prévio.</p>

            <h2 className="text-2xl font-semibold mt-6 mb-2">11. Foro</h2>
            <p>
                Fica eleito o foro de Porto Alegre – RS para resolução de disputas.
            </p>
        </div>
    );
}
