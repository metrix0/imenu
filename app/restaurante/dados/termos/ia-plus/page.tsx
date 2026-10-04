import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Termos do iMenu IA Plus",
    description:
        "Condições de contratação e uso do sistema iMenu IA Plus.",
};

const SUPPORT_URL =
    "https://wa.me/5519997235394?text=Ol%C3%A1%2C%20tenho%20uma%20d%C3%BAvida%20sobre%20os%20Termos%20do%20iMenu%20IA%20Plus.";

export default function IaPlusTermsPage() {
    return (
        <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
            <article className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
                    Sistemas iMenu
                </p>
                <h1 className="mt-3 text-3xl font-bold text-gray-900">
                    Termos do iMenu IA Plus
                </h1>
                <p className="mt-3 text-sm text-gray-500">
                    Última atualização: 4 de outubro de 2026
                </p>

                <div className="mt-8 space-y-8 text-sm leading-7 text-gray-700 sm:text-base">
                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            1. Objeto
                        </h2>
                        <p className="mt-2">
                            Estes termos regulam a contratação e o uso do iMenu
                            IA Plus, sistema adicional ao iMenu Cardápio Digital
                            que oferece recursos de inteligência artificial para
                            análise de vendas, assistência na gestão e criação de
                            conteúdo para o restaurante.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            2. Funcionalidades
                        </h2>
                        <p className="mt-2">
                            O iMenu IA Plus pode analisar dados do restaurante,
                            sugerir melhorias, auxiliar em descrições, preços e
                            configurações, gerar imagens e apresentar
                            oportunidades identificadas a partir da Análise de
                            Vendas com IA. As funcionalidades disponíveis podem
                            evoluir ao longo do tempo.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            3. Uso de inteligência artificial
                        </h2>
                        <p className="mt-2">
                            As respostas e sugestões são produzidas por sistemas
                            de inteligência artificial e podem conter erros,
                            imprecisões ou interpretações inadequadas. O
                            restaurante deve revisar as informações antes de
                            utilizá-las em sua operação.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            4. Revisão e aplicação de mudanças
                        </h2>
                        <p className="mt-2">
                            Quando uma funcionalidade puder alterar dados do
                            restaurante, como itens, descrições, preços ou
                            configurações, a mudança é apresentada para revisão
                            e depende de uma ação de confirmação na interface
                            antes de ser aplicada.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            5. Conteúdo gerado
                        </h2>
                        <p className="mt-2">
                            Textos, imagens e demais conteúdos produzidos com
                            auxílio da IA devem ser revisados pelo restaurante
                            antes da publicação. O restaurante é responsável por
                            verificar se o conteúdo final representa
                            corretamente seus produtos, preços e informações e
                            se pode ser utilizado na forma pretendida.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            6. Preço e cobrança
                        </h2>
                        <p className="mt-2">
                            O iMenu IA Plus custa R$ 49,99 por mês. No cartão, a
                            assinatura é renovada automaticamente até o
                            cancelamento. No Pix, o pagamento é único e libera
                            um mês de acesso, sem ativar cobrança recorrente. O
                            pagamento é processado pelo Asaas e o iMenu não
                            armazena os dados completos do cartão. Qualquer
                            alteração de preço será informada antes de produzir
                            efeitos em uma renovação futura.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            7. Ativação
                        </h2>
                        <p className="mt-2">
                            A ativação ocorre após a confirmação do pagamento.
                            Pagamentos pendentes, recusados, vencidos ou
                            estornados podem impedir ou suspender o acesso ao
                            iMenu IA Plus.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            8. Cancelamento
                        </h2>
                        <p className="mt-2">
                            A assinatura recorrente pode ser cancelada nas
                            Configurações do painel. O cancelamento interrompe as
                            próximas renovações e, quando houver período já pago,
                            o acesso poderá permanecer disponível até o fim
                            desse período.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            9. Direito de arrependimento
                        </h2>
                        <p className="mt-2">
                            Quando a legislação de consumo for aplicável, o
                            contratante poderá exercer o direito de
                            arrependimento no prazo legal de 7 dias contado da
                            contratação, solicitando o cancelamento e o estorno
                            pelos canais de atendimento do iMenu.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            10. Disponibilidade
                        </h2>
                        <p className="mt-2">
                            O funcionamento dos recursos de IA pode depender da
                            conexão com a internet e de serviços tecnológicos de
                            terceiros. O iMenu poderá realizar manutenções,
                            correções e atualizações necessárias ao sistema.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            11. Privacidade
                        </h2>
                        <p className="mt-2">
                            O tratamento de dados segue a{" "}
                            <Link
                                href="/restaurante/dados/privacidade"
                                className="font-semibold text-brand underline underline-offset-2"
                            >
                                Política de Privacidade do iMenu
                            </Link>
                            .
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            12. Atendimento
                        </h2>
                        <p className="mt-2">
                            Dúvidas, cancelamentos e solicitações relacionadas ao
                            iMenu IA Plus podem ser enviados pelo{" "}
                            <a
                                href={SUPPORT_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-brand underline underline-offset-2"
                            >
                                atendimento do iMenu
                            </a>
                            .
                        </p>
                    </section>
                </div>
            </article>
        </main>
    );
}
