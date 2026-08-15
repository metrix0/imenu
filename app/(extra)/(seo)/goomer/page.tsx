import { SeoPage } from "@/components/common/SeoPage";


export const metadata = {
    title: "iMenu vs Goomer | Comparação de Cardápio Digital",
    description:
        "Compare iMenu e Goomer e entenda as diferenças entre custo, facilidade de uso e modelo de cobrança para restaurantes.",
    alternates: {
        canonical: "https://imenuapp.com.br/goomer",
    },
};

export default function Page() {
    return (
        <SeoPage
            h1="iMenu vs Goomer: qual cardápio digital vale mais a pena?"
            description={<>Veja as principais diferenças entre iMenu e Goomer e escolha a melhor solução de cardápio digital para seu restaurante.  Veja nossa comparação dos <a className={"text-blue-500 underline"} href={"/cardapio-digital"}>Top 5 Cardápios Digitais GRÁTIS</a></>}
            imageSrc="/images/Menu_Mockup_3.png"
            imageAlt="Comparação entre iMenu e Goomer"
            ctaLabel="Criar cardápio no iMenu gratuitamente"
        >
            <section>
                <h2 className="text-2xl font-bold mb-4">
                    O que é o Goomer
                </h2>
                <p className="text-gray-600">
                    O Goomer é uma plataforma de cardápio digital e autoatendimento voltada
                    principalmente para operações presenciais, com foco em totens,
                    integrações e soluções mais robustas para redes e franquias.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Diferenças de modelo de cobrança
                </h2>
                <p className="text-gray-600">
                    Enquanto o Goomer costuma trabalhar com planos pagos e contratos,
                    o iMenu oferece um cardápio digital gratuito, sem mensalidade e sem
                    necessidade de negociações comerciais para começar.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Simplicidade vs soluções complexas
                </h2>
                <p className="text-gray-600">
                    Restaurantes pequenos e médios geralmente não precisam de sistemas
                    complexos. O iMenu atende exatamente esse público, oferecendo apenas
                    o essencial para vender mais, sem sobrecarga operacional.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Quando o iMenu é a melhor escolha
                </h2>
                <p className="text-gray-600">
                    Se você busca um cardápio digital rápido de implementar, fácil de usar
                    e sem custo fixo, o iMenu é a opção mais direta e econômica em relação
                    ao Goomer.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    O que testar antes de escolher
                </h2>
                <ul className="space-y-2 text-gray-600 list-disc list-inside">
                    <li>Simule a compra em um celular comum, do acesso ao pedido final.</li>
                    <li>Verifique se totens, integrações ou equipamentos serão realmente usados.</li>
                    <li>Calcule o custo total, incluindo implantação, mensalidade e suporte.</li>
                    <li>Peça para a equipe operar cada opção durante um horário movimentado.</li>
                </ul>
                <p className="text-gray-600 mt-4">
                    Compare as condições comerciais atuais das plataformas. A melhor escolha
                    é a que resolve o seu fluxo sem adicionar custo e complexidade desnecessários.
                </p>
            </section>
        </SeoPage>
    );
}
