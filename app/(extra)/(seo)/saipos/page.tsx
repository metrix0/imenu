import { SeoPage } from "@/components/common/SeoPage";


export const metadata = {
    title: "iMenu vs Saipos | Cardápio Digital e Pedidos",
    description:
        "Compare iMenu e Saipos e descubra qual solução de cardápio digital faz mais sentido para seu restaurante.",
    alternates: {
        canonical: "https://imenuapp.com.br/saipos",
    },
};

export default function Page() {
    return (
        <SeoPage
            h1="iMenu vs Saipos"
            description={<>Compare o iMenu com o Saipos e entenda qual plataforma oferece mais simplicidade e menos custo para restaurantes.  Veja nossa comparação dos <a className={"text-blue-500 underline"} href={"/cardapio-digital"}>Top 5 Cardápios Digitais GRÁTIS</a></>}
            imageSrc="/images/MonitorGraph.png"
            imageAlt="Comparação entre iMenu e Saipos"
            ctaLabel="Usar o iMenu gratuitamente"
        >
            <section>
                <h2 className="text-2xl font-bold mb-4">
                    O que é o Saipos
                </h2>
                <p className="text-gray-600">
                    O Saipos é um sistema de gestão para restaurantes, com foco em PDV,
                    controle financeiro e operações internas. Ele atende principalmente
                    negócios que precisam de gestão completa do restaurante.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Cardápio digital como parte do sistema
                </h2>
                <p className="text-gray-600">
                    No Saipos, o cardápio digital é apenas um módulo dentro de uma solução
                    maior. Já no iMenu, o cardápio digital é o produto principal,
                    otimizado para conversão e facilidade de uso.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Custo e complexidade
                </h2>
                <p className="text-gray-600">
                    Sistemas completos como o Saipos costumam exigir planos pagos,
                    treinamento e suporte técnico. O iMenu elimina essa complexidade,
                    permitindo que o restaurante comece sem investimento inicial.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Qual escolher
                </h2>
                <p className="text-gray-600">
                    Restaurantes que querem apenas um cardápio digital funcional e sem
                    mensalidade encontram no iMenu a solução ideal, sem precisar contratar
                    um ERP completo.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Decida pelo problema que precisa resolver
                </h2>
                <ul className="space-y-2 text-gray-600 list-disc list-inside">
                    <li>Mapeie se você precisa apenas vender online ou gerir toda a operação.</li>
                    <li>Separe recursos essenciais de módulos que não serão usados agora.</li>
                    <li>Compare implantação, treinamento, mensalidade e integrações necessárias.</li>
                    <li>Teste cadastro, recebimento e atualização de um pedido completo.</li>
                </ul>
                <p className="text-gray-600 mt-4">
                    Valide os planos e recursos atuais diretamente com cada plataforma. Assim,
                    você evita contratar uma estrutura maior — ou menor — do que o restaurante precisa.
                </p>
            </section>
        </SeoPage>
    );
}
