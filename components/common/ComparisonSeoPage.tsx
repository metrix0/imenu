import { SeoPage } from "@/components/common/SeoPage";
import type { ComparisonPageDefinition } from "@/lib/seo/comparisonPages";

type ComparisonSeoPageProps = Pick<
    ComparisonPageDefinition,
    | "competitor"
    | "intro"
    | "competitorOverview"
    | "mainDifference"
    | "competitorFit"
    | "imenuFit"
    | "checklist"
>;

export default function ComparisonSeoPage({
    competitor,
    intro,
    competitorOverview,
    mainDifference,
    competitorFit,
    imenuFit,
    checklist,
}: ComparisonSeoPageProps) {
    return (
        <SeoPage
            h1={`iMenu vs ${competitor}`}
            description={
                <>
                    {intro} Veja também nossa comparação dos{" "}
                    <a
                        className="text-blue-500 underline"
                        href="/cardapio-digital"
                    >
                        Top 5 Cardápios Digitais GRÁTIS
                    </a>
                    .
                </>
            }
            imageSrc="/images/Top-5-Cardapios-Digitais.png"
            imageAlt={`Comparação entre iMenu e ${competitor}`}
            ctaLabel="Usar o iMenu gratuitamente"
        >
            <section>
                <h2 className="mb-4 text-2xl font-bold">
                    O que é o {competitor}
                </h2>
                <p className="text-gray-600">{competitorOverview}</p>
            </section>

            <section>
                <h2 className="mb-4 text-2xl font-bold">
                    Diferença entre iMenu e {competitor}
                </h2>
                <p className="text-gray-600">{mainDifference}</p>
            </section>

            <section>
                <h2 className="mb-4 text-2xl font-bold">
                    Quando o {competitor} pode fazer mais sentido
                </h2>
                <p className="text-gray-600">{competitorFit}</p>
            </section>

            <section>
                <h2 className="mb-4 text-2xl font-bold">
                    Quando escolher o iMenu
                </h2>
                <p className="text-gray-600">{imenuFit}</p>
            </section>

            <section>
                <h2 className="mb-4 text-2xl font-bold">
                    O que comparar antes de decidir
                </h2>
                <ul className="list-inside list-disc space-y-2 text-gray-600">
                    {checklist.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
                <p className="mt-4 text-gray-600">
                    Recursos, preços e condições comerciais podem mudar. Confirme a
                    oferta atual de cada plataforma e escolha a solução que melhor se
                    encaixa no fluxo real da sua equipe.
                </p>
            </section>
        </SeoPage>
    );
}
