import { SeoPage } from "@/components/common/SeoPage";
import Button from "@/components/ui/Button";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faWandMagicSparkles, faChartSimple, faLink, faLockOpen } from "@fortawesome/free-solid-svg-icons";

export const metadata = {
    title: "Os 5 melhores Cardápios Digitais GRÁTIS do Brasil | iMenu",
    description:
        "Compare as principais plataformas de cardápio digital para restaurantes. Veja preços, limitações e por que o iMenu é o melhor cardápio digital gratuito.",
    alternates: {
        canonical: "https://imenuapp.com.br/cardapio-digital",
    },
};


export default function Page() {
    return (
        <SeoPage
            h1="Top 5 Cardápios Digitals Gratuitos no Brasil"
            description="Conheça as principais plataformas de cardápio digital do mercado e descubra qual oferece mais recursos, menos custos e melhor experiência para restaurantes."
            imageSrc="/images/Top-5-Cardapios-Digitais.png"
            imageAlt="Top 5 Cardápios Digitals Gratuitos no Brasil"
            ctaLabel="Criar cardápio digital grátis"
        >
            {/* INTRO */}
            <section>
                <h2 className="text-2xl font-bold mb-4">
                    O que é um cardápio digital
                </h2>
                <p className="text-gray-600">
                    O <strong>cardápio digital</strong> é a evolução do menu tradicional.
                    Ele permite que restaurantes e delivery exibam produtos online, por
                    link ou QR Code, com fotos, descrições, preços e opcionais sempre
                    atualizados. Além de reduzir custos com impressão, melhora a
                    experiência do cliente e aumenta a taxa de conversão. Permitindo também pedidos por delivery sem ser taxado.
                </p>
            </section>

            {/* MARKET OVERVIEW */}
            <section>
                <h2 className="text-2xl font-bold mb-4">
                    As principais plataformas de cardápio digital em 2025
                </h2>
                <p className="text-gray-600 mb-6">
                    Hoje existem diversas soluções de cardápio digital no mercado, cada
                    uma com propostas diferentes. Algumas focam em gestão completa, outras
                    em totens e autoatendimento, e outras em planos pagos com múltiplas
                    limitações.
                </p>

                <ul className="space-y-3 text-gray-600 list-disc list-inside">
                    <li>
                        <a href={"/anota-ai"}  className={"!text-blue-500 underline"}><strong >Anota Ai</strong></a> — solução robusta, voltada para gestão de
                        pedidos, geralmente com planos pagos.
                    </li>
                    <li>
                        <a href={"/goomer"}  className={"!text-blue-500 underline"}><strong>Goomer</strong></a> — focado em autoatendimento e operações
                        maiores, com contratos e mensalidade.
                    </li>
                    <li>
                        <a href={"/saipos"}  className={"!text-blue-500 underline"}><strong>Saipos</strong></a> — sistema completo de gestão e PDV, onde o
                        cardápio digital é apenas um módulo.
                    </li>
                    <li>
                        <a href={"/"}  className={"!text-blue-500 underline"}><strong>iMenu</strong></a> — focado em cardápio digital gratuito, sem mensalidades, sem taxas. Usa IA para montar seu cardápio.
                    </li>
                    <li>
                        <strong>Outras plataformas</strong> — oferecem planos gratuitos
                        limitados, com marca d’água, limite de pedidos ou funcionalidades
                        bloqueadas.
                    </li>
                </ul>
            </section>

            {/* COMPARISON */}
            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Comparando os melhores cardápios digitais
                </h2>
                <p className="text-gray-600 mb-6">
                    Ao comparar plataformas de cardápio digital, é importante avaliar
                    custo, facilidade de uso, limitações e impacto real na operação do
                    restaurante.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-5 rounded-xl">
                        <h3 className="font-semibold text-lg mb-2">
                            Plataformas tradicionais
                        </h3>
                        <ul className="text-gray-600 space-y-2 list-disc list-inside">
                            <li>Mensalidade ou planos obrigatórios</li>
                            <li>Limite de pedidos ou funcionalidades</li>
                            <li>Configuração mais complexa</li>
                            <li>Dependência de suporte técnico</li>
                        </ul>
                    </div>

                    <div className="bg-green-50 p-5 rounded-xl border border-green-200">
                        <h3 className="font-semibold text-lg mb-2 text-green-700">
                            iMenu
                        </h3>
                        <ul className="text-gray-700 space-y-2 list-disc list-inside">
                            <li>100% gratuito, sem mensalidade</li>
                            <li>Pedidos e acessos ilimitados</li>
                            <li>Configuração em minutos</li>
                            <li>Foco total em conversão e simplicidade</li>
                        </ul>
                    </div>
                </div>
            </section>

            <section className="space-y-10 mb-30">
                <h2 className="text-2xl font-bold">
                    Por que o iMenu se destaca entre os melhores
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-14 gap-y-10">
                    <div className="flex gap-4">
                        <FontAwesomeIcon
                            icon={faWandMagicSparkles}
                            className="text-brand mt-1"
                        />
                        <div>
                            <h3 className="text-lg font-semibold mb-2">
                                Leitura automática de cardápio com IA
                            </h3>
                            <p className="text-gray-600 leading-relaxed">
                                Envie uma foto ou PDF do seu cardápio e o iMenu converte automaticamente
                                em um cardápio digital estruturado, com categorias, produtos e preços.
                                O que antes levava horas acontece em minutos.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <FontAwesomeIcon
                            icon={faLockOpen}
                            className="text-brand mt-1"
                        />
                        <div>
                            <h3 className="text-lg font-semibold mb-2">
                                Gratuito de verdade
                            </h3>
                            <p className="text-gray-600 leading-relaxed">
                                Sem mensalidade, sem taxa por pedido e sem planos escondidos.
                                Todos os recursos essenciais ficam disponíveis desde o primeiro acesso,
                                sem bloqueios artificiais.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <FontAwesomeIcon
                            icon={faLink}
                            className="text-brand mt-1"
                        />
                        <div>
                            <h3 className="text-lg font-semibold mb-2">
                                Um único cardápio para todos os canais
                            </h3>
                            <p className="text-gray-600 leading-relaxed">
                                Use o mesmo cardápio digital no QR Code da mesa, no WhatsApp,
                                redes sociais ou links diretos. Atualizações em tempo real,
                                sem duplicar trabalho.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <FontAwesomeIcon
                            icon={faChartSimple}
                            className="text-brand mt-1"
                        />
                        <div>
                            <h3 className="text-lg font-semibold mb-2">
                                Experiência pensada para conversão
                            </h3>
                            <p className="text-gray-600 leading-relaxed">
                                Interface rápida, clara e sem distrações. O foco é facilitar a escolha
                                do cliente, reduzir abandono e aumentar pedidos — sem exigir
                                treinamento ou suporte.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CONCLUSION */}
            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Qual é o melhor cardápio digital gratuito?
                </h2>
                <p className="text-gray-600">
                    Ao comparar as principais plataformas de cardápio digital, o iMenu se
                    destaca como a opção mais completa para restaurantes que buscam
                    simplicidade, custo zero e rapidez. Sem mensalidade, com tecnologia de
                    IA e foco total na experiência do cliente, o iMenu entrega mais sem
                    cobrar por isso.
                </p>

                <Button className={"mt-6 py-3 px-8"}>
                    Registre-se já
                </Button>
            </section>
        </SeoPage>
    );
}