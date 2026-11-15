import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { faHandshake } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, { BlogSection, BlogSteps } from "@/components/common/blog/BlogArticle";
import { createBlogArticleMetadata, getBlogArticle } from "@/lib/seo/blogArticles";

const article = getBlogArticle("programa-de-afiliados-imenu")!;
export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "como-participar", label: "Como participar" },
    { id: "acompanhamento", label: "Como rastreamos suas indicações" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Quanto recebo por indicação?",
        answer: "Você recebe 50% de cada pagamento confirmado do iMenu Plus das contas que você indicar, incluindo a primeira assinatura e todas as renovações, sem prazo limite.",
    },
    {
        question: "Quando recebo as comissões?",
        answer: "As comissões são pagas aos sábados após o dia 10 de cada mês.",
    },
    {
        question: "E se o restaurante assinar mais tarde?",
        answer: "O navegador lembra o primeiro link válido por 30 dias. Se o restaurante criar a conta ou iniciar a primeira compra do Plus nesse período, a indicação fica vinculada à conta e acompanha os pagamentos futuros.",
    },
];

export default function AffiliateProgramPage() {
    const message = "Olá! Quero me tornar afiliado do iMenu.";
    const applicationLink = `https://wa.me/5519997235394?text=${encodeURIComponent(message)}`;
    return (
        <BlogArticle
            article={article}
            icon={faHandshake}
            guideLabel="Programa de Afiliados"
            action={
                <a href={applicationLink} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-white transition hover:bg-brand/90">
                    <FontAwesomeIcon icon={faWhatsapp} className="h-5 w-5" aria-hidden="true" />
                    Quero ser um afiliado
                </a>
            }
            takeaways={[
                "Um link exclusivo para suas indicações",
                "50% de cada pagamento do iMenu Plus, incluindo renovações",
                "Comissões pagas aos sábados após o dia 10",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={["imenu-plus"]}
        >
            <BlogSection id="como-participar" title="Como participar">
                <BlogSteps items={[
                    { title: "Fale com a equipe", description: "Chame o iMenu no WhatsApp para participar e receber seu link exclusivo." },
                    { title: "Compartilhe seu link", description: "Envie o link aos restaurantes que você quer indicar para que eles conheçam o iMenu." },
                    { title: "Receba comissão", description: "Cada pagamento confirmado do iMenu Plus das contas indicadas gera 50% de comissão para você." },
                ]} />
            </BlogSection>

            <BlogSection id="acompanhamento" title="Como rastreamos suas indicações">
                <p>
                    Seu link tem um código exclusivo. Quando um restaurante usa esse link, o iMenu lembra a indicação
                    no navegador por 30 dias. Se a pessoa criar a conta ou iniciar a primeira compra do Plus nesse
                    período, o código fica vinculado à conta.
                </p>
                <p>
                    A partir daí, o iMenu cruza a indicação com os pagamentos confirmados, inclusive as renovações.
                    Cada pagamento tem um identificador único e entra uma única vez na apuração. A equipe pode
                    conferir a indicação e os pagamentos no histórico.
                </p>
            </BlogSection>
        </BlogArticle>
    );
}
