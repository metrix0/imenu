import Link from "next/link";
import { faFilm } from "@fortawesome/free-solid-svg-icons";

import BlogArticle, {
    BlogChecklist,
    BlogSection,
    BlogSteps,
} from "@/components/common/blog/BlogArticle";
import { MAX_MENU_VIDEO_MB } from "@/lib/menu/itemMedia";
import { createBlogArticleMetadata, getBlogArticle } from "@/lib/seo/blogArticles";

const article = getBlogArticle("cardapio-digital-com-fotos-e-videos")!;
export const metadata = createBlogArticleMetadata(article);

const sections = [
    { id: "como-montar", label: "Como montar a galeria do prato" },
    { id: "como-adicionar", label: "Como adicionar fotos e vídeo no iMenu" },
    { id: "como-gravar", label: "Como gravar um vídeo curto do prato" },
    { id: "perguntas-frequentes", label: "Perguntas frequentes" },
];

const faq = [
    {
        question: "Posso colocar várias fotos no mesmo produto do cardápio?",
        answer: "Sim. Com iMenu Plus, você pode adicionar até três fotos por produto ou usar uma das posições extras para um vídeo. A primeira foto é gratuita.",
    },
    {
        question: "Posso trocar a foto principal depois?",
        answer: "Sim. Em Configurações do item, na seção Fotos e Vídeo, você pode trocar a capa. Se tiver Plus, pode reorganizar as fotos da galeria.",
    },
    {
        question: "Qual é o limite de duração do vídeo do cardápio?",
        answer: `Cada item pode ter um vídeo de até 30 segundos e ${MAX_MENU_VIDEO_MB} MB. Adicione a foto principal antes de enviar o vídeo.`,
    },
    {
        question: "O que acontece com a galeria de fotos e vídeo se o Plus vencer?",
        answer: "A foto principal continua visível. A galeria fica salva e volta a aparecer quando o iMenu Plus estiver ativo.",
    },
];

export default function CardapioDigitalComFotosEVideosPage() {
    return (
        <BlogArticle
            article={article}
            icon={faFilm}
            takeaways={[
                "Escolha uma capa que ajude a reconhecer o prato de relance",
                "Mostre porção, recheio e textura com ângulos diferentes",
                "Adicione múltiplas fotos e um vídeo pelo painel do iMenu",
            ]}
            sections={sections}
            faq={faq}
            relatedSlugs={["como-montar-cardapio-delivery", "criar-cardapio-com-ia", "imenu-plus"]}
            ctaTitle="Mostre seus pratos no cardápio digital do iMenu"
        >
            <BlogSection id="como-montar" title="O que mostrar em cada foto de um cardápio digital">
                <p>
                    A primeira foto é a capa do produto. Mostre a porção que o cliente recebe, com
                    o prato inteiro em destaque. Use outros ângulos para responder perguntas que a capa
                    deixa em aberto. Uma foto lateral mostra a altura de um hambúrguer. Uma foto
                    da fatia mostra o recheio do bolo. Uma foto do combo aberto mostra quais
                    acompanhamentos chegam junto.
                </p>
                <p>
                    Reserve o vídeo para algo que fica mais claro em movimento, como o corte de
                    uma pizza ou o ponto de um brigadeiro de colher. A descrição do produto
                    continua sendo o lugar para informar ingredientes, tamanho e o que está incluído.
                </p>
            </BlogSection>

            <BlogSection id="como-adicionar" title="Como colocar fotos e vídeo no cardápio do iMenu">
                <BlogSteps items={[
                    { title: "Abra as configurações do item", description: "No painel Cardápio, encontre o produto e abra Configurações do item." },
                    { title: "Envie a foto principal", description: "Em Fotos e Vídeo, adicione a imagem na primeira posição. Ela fica como capa e é gratuita." },
                    { title: "Monte a galeria", description: "Com iMenu Plus ativo, preencha as posições extras com fotos ou um vídeo. Cada item comporta até três mídias no total." },
                    { title: "Confira o cardápio publicado", description: "Abra o produto pelo link do cardápio para conferir o enquadramento das fotos e a reprodução do vídeo no celular." },
                ]} />
                <p>
                    Com o <Link href="/blog/imenu-plus" className="font-semibold text-brand underline">iMenu Plus</Link>,
                    as múltiplas fotos e o vídeo aparecem na galeria do item. A capa continua sendo
                    a primeira foto cadastrada.
                </p>
            </BlogSection>

            <BlogSection id="como-gravar" title="Como gravar um vídeo curto para o seu prato">
                <p>
                    Escolha um movimento e deixe o prato preencher boa parte do quadro. Para
                    mostrar um sanduíche, grave perto de uma janela e corte o pão de forma que as
                    camadas fiquem voltadas para a câmera. Para um combo, comece com a embalagem
                    aberta e mostre os itens na mesma tomada.
                </p>
                <BlogChecklist items={[
                    "Use luz difusa e um fundo que contraste com a comida",
                    "Mostre a porção e os acompanhamentos que fazem parte do preço",
                    "Enquadre os detalhes mais importantes no centro",
                    "Reproduza o vídeo no celular e confira se ele faz sentido mesmo sem áudio",
                ]} />
            </BlogSection>
        </BlogArticle>
    );
}
