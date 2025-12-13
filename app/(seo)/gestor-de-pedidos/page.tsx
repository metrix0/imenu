import { SeoPage } from "@/components/common/SeoPage";


export const metadata = {
    title: "Gestor de Pedidos para Restaurante | iMenu",
    description:
        "Gestor de pedidos para restaurante: organize, acompanhe e gerencie pedidos com mais eficiência usando o iMenu.",
    alternates: {
        canonical: "https://imenuapp.com.br/gestor-de-pedidos",
    },
};

export default function Page() {
    return (
        <SeoPage
            h1="Gestor de pedidos para restaurante"
            description={<>Organize pedidos, evite erros e tenha mais controle da operação com um gestor de pedidos simples e integrado ao cardápio digital. Veja nossa comparação dos <a className={"text-blue-500 underline"} href={"/cardapio-digital"}>Top 5 Cardápios Digitais GRÁTIS</a></>}
            imageSrc="/images/MonitorGraph.png"
            imageAlt="Gestor de pedidos para restaurante"
            ctaLabel="Usar gestor de pedidos gratuitamente"
        >
            <section>
                <h2 className="text-2xl font-bold mb-4">
                    O que é um gestor de pedidos
                </h2>
                <p className="text-gray-600">
                    Um gestor de pedidos para restaurante centraliza todos os pedidos em
                    um único painel, permitindo acompanhar status, valores e informações
                    do cliente com mais clareza e menos erros operacionais.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Como o gestor de pedidos melhora a operação
                </h2>
                <p className="text-gray-600">
                    Ao organizar os pedidos em tempo real, o restaurante reduz retrabalho,
                    evita confusões no atendimento e ganha mais previsibilidade na
                    produção, especialmente em horários de pico.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Integração com cardápio digital
                </h2>
                <p className="text-gray-600">
                    Quando o gestor de pedidos está integrado ao cardápio digital, o fluxo
                    se torna automático. O cliente escolhe, envia o pedido e o restaurante
                    recebe tudo organizado, sem intermediários.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Gestor de pedidos gratuito
                </h2>
                <p className="text-gray-600">
                    O iMenu oferece um gestor de pedidos sem mensalidade, permitindo que
                    restaurantes tenham controle da operação sem aumentar custos fixos.
                </p>
            </section>
        </SeoPage>
    );
}
