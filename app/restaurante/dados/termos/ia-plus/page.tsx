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
                        <p className="mt-2">
                            O Assistente IA possui acesso gratuito com limites
                            de processamento e imagens. A aba Vendas IA e a
                            liberação de análises gratuitas também estão
                            disponíveis sem contratar este adicional, conforme
                            a seleção de restaurantes e a visualização liberada.
                            O IA Plus amplia a capacidade do Assistente e libera
                            o acesso completo, a conversa sobre a análise e a
                            aplicação de suas propostas após aprovação. O acesso
                            à análise sem depender da seleção gratuita não
                            representa garantia de conclusão imediata ou de
                            prazo fixo de processamento.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">
                            2.1. Capacidade, contagem e limites de uso
                        </h2>
                        <p className="mt-2">
                            A contratação do IA Plus oferece maior capacidade,
                            mas não constitui uso ilimitado. Tokens são unidades
                            de processamento de conteúdo pela IA. O consumo
                            inclui as entradas e respostas, o contexto da
                            conversa, os dados consultados e as etapas necessárias
                            à tarefa; não corresponde apenas ao tamanho da
                            mensagem digitada nem a um número fixo de mensagens.
                            Uma tarefa pode exigir várias etapas de processamento.
                        </p>
                        <ul className="mt-3 list-disc space-y-2 pl-5">
                            <li>
                                No acesso gratuito, a capacidade de conversa é
                                de 150.000 tokens e uma geração de imagem por
                                restaurante nos últimos sete dias. Essa janela é
                                móvel: o uso deixa de contar quando completa sete
                                dias, sem um dia único de reinício para todos.
                                As análises de vendas geradas separadamente não
                                consomem a franquia gratuita de conversa.
                            </li>
                            <li>
                                Cada solicitação gratuita tem limite de 60.000
                                tokens de processamento, considerando também o
                                contexto e as etapas da tarefa. Uma última
                                solicitação pode ultrapassar o saldo semanal
                                restante, dentro desse limite por solicitação.
                                Essa tolerância não cria uma franquia adicional
                                recorrente; após esgotar a capacidade, novas
                                solicitações ficam bloqueadas até a recomposição
                                do saldo ou a ativação do IA Plus.
                            </li>
                            <li>
                                No IA Plus, o Assistente está sujeito a tetos
                                mensais de 1.500.000 tokens de entrada e 120.000
                                tokens de saída e à capacidade de até 12 gerações
                                de imagem por restaurante no mês calendário.
                                A contagem mensal usa o horário de referência do
                                servidor (UTC). Cada pedido de conversa aceita
                                até 100.000 tokens estimados de entrada por etapa
                                e até 6.000 tokens de saída na execução, conforme
                                a capacidade disponível.
                            </li>
                            <li>
                                Reservas de capacidade para solicitações em
                                andamento e estimativas de contexto podem
                                antecipar o bloqueio de uma tarefa que não caiba
                                no saldo. Os limites não garantem um número exato
                                de mensagens, propostas concluídas ou imagens
                                aprovadas. Gerações são contabilizadas no
                                processamento, independentemente da publicação
                                ou aceitação da imagem.
                            </li>
                            <li>
                                Também existem limites técnicos de frequência,
                                processamento simultâneo, tamanho e quantidade
                                de anexos e operações por proposta. Solicitações
                                extensas podem precisar ser divididas ou feitas
                                em uma nova conversa. Análises podem aguardar
                                processamento e ser interrompidas em caso de
                                falha ou falta de capacidade.
                            </li>
                        </ul>
                        <p className="mt-3">
                            Ao atingir o limite de imagens, novas gerações são
                            suspensas, mas o Assistente pode continuar outras
                            tarefas se houver capacidade de conversa. Ao atingir
                            o limite de conversa, novas solicitações de IA podem
                            ser suspensas. Esses bloqueios não impedem o uso
                            normal do cardápio ou a edição manual no painel e
                            não geram cobrança adicional automática.
                        </p>
                        <p className="mt-2">
                            Alterações materiais das franquias e condições do
                            IA Plus serão informadas com antecedência e, para
                            assinaturas em curso, antes de produzirem efeitos
                            em uma renovação futura. Permanecem assegurados os
                            direitos legais do contratante e o cancelamento
                            pelos canais indicados nestes termos.
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
                        <p className="mt-2">
                            Projeções de receita são estimativas baseadas nos
                            dados disponíveis e em hipóteses, podem cobrir apenas
                            parte das oportunidades e não garantem faturamento,
                            conversão ou lucro. Os resultados dependem também
                            dos custos, da operação e do comportamento dos
                            clientes. A qualidade da análise depende da
                            disponibilidade e da exatidão dos dados.
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
                        <p className="mt-2">
                            Após a aprovação, o sistema executa as alterações
                            autorizadas nos campos permitidos. A geração de uma
                            imagem prepara uma prévia e não autoriza sua
                            publicação. Se os dados tiverem mudado desde a
                            proposta, poderá ser necessária uma nova revisão.
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
