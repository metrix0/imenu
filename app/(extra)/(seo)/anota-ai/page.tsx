import { SeoPage } from "@/components/common/SeoPage";


export const metadata = {
    title: "iMenu vs Anota Ai | Comparação de Cardápio Digital",
    description:
        "Compare iMenu e Anota Ai e descubra qual solução de cardápio digital é mais simples e econômica para restaurantes.",
    alternates: {
        canonical: "https://imenuapp.com.br/anota-ai",
    },
};

export default function Page() {
    return (
        <SeoPage
            h1="iMenu vs Anota Ai"
            description={<>Compare duas soluções de cardápio digital e veja qual é a melhor escolha para restaurantes que buscam simplicidade e baixo custo. Veja nossa comparação dos <a className={"text-blue-500 underline"} href={"/cardapio-digital"}>Top 5 Cardápios Digitais GRÁTIS</a></>}
            imageSrc="/images/MonitorGraph.png"
            imageAlt="Comparação entre iMenu e Anota Ai"
            ctaLabel="Usar o iMenu gratuitamente"
        >
            <section>
                <h2 className="text-2xl font-bold mb-4">
                    O que é o Anota Ai
                </h2>
                <p className="text-gray-600">
                    O Anota Ai é uma plataforma voltada para gestão de pedidos e operações
                    de delivery, oferecendo diversos recursos avançados que geralmente
                    exigem contratação de planos pagos.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Diferença entre iMenu e Anota Ai
                </h2>
                <p className="text-gray-600">
                    Enquanto o Anota Ai foca em uma solução mais robusta, o iMenu resolve o
                    essencial: cardápio digital funcional, rápido e sem custo. O iMenu é
                    ideal para restaurantes que não precisam de múltiplos módulos.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Simplicidade e facilidade de uso
                </h2>
                <p className="text-gray-600">
                    Restaurantes que buscam rapidez na implementação preferem o iMenu,
                    pois não há curva de aprendizado ou configuração complexa.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Quando escolher o iMenu
                </h2>
                <p className="text-gray-600">
                    Se o objetivo é divulgar o cardápio online, reduzir erros de pedido e
                    evitar mensalidades, o iMenu é a alternativa mais direta e econômica.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Como comparar as duas opções na prática
                </h2>
                <ul className="space-y-2 text-gray-600 list-disc list-inside">
                    <li>Liste os recursos indispensáveis para a sua operação hoje.</li>
                    <li>Some mensalidade, implantação, taxas por pedido e possíveis extras.</li>
                    <li>Teste o pedido completo no celular do cliente e no painel da equipe.</li>
                    <li>Confirme suporte, cancelamento e exportação dos seus dados.</li>
                </ul>
                <p className="text-gray-600 mt-4">
                    Planos e condições comerciais podem mudar. Confira a proposta atual de
                    cada plataforma e escolha pelo fluxo que sua equipe realmente consegue usar.
                </p>
            </section>
        </SeoPage>
    );
}
