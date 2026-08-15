import { SeoPage } from "@/components/common/SeoPage";


export const metadata = {
    title: "Cardápio Digital Gratuito para Restaurantes | iMenu",
    description:
        "Cardápio digital gratuito para restaurantes e delivery. Sem mensalidade, sem taxas e sem limite de pedidos.",
    alternates: {
        canonical: "https://imenuapp.com.br/cardapio-digital-gratuito",
    },
};

export default function Page() {
    return (
        <SeoPage
            h1="Cardápio digital gratuito para restaurantes"
            description={<>Crie um cardápio digital gratuito para seu restaurante, sem mensalidades, taxas escondidas ou limite de uso. Veja nossa comparação dos <a className={"text-blue-500 underline"} href={"/cardapio-digital"}>Top 5 Cardápios Digitais GRÁTIS</a></>}
            imageSrc="/images/Menu_Mockup_2.png"
            imageAlt="Cardápio digital gratuito do iMenu"
            ctaLabel="Criar cardápio grátis agora"
        >
            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Cardápio digital gratuito: como funciona
                </h2>
                <p className="text-gray-600">
                    Um cardápio digital gratuito permite que restaurantes divulguem seus
                    produtos online sem pagar mensalidade ou comissão. Ele pode ser
                    acessado por link direto ou QR Code, facilitando o acesso dos clientes
                    tanto no salão quanto no delivery.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Sem mensalidade, sem taxas e sem surpresas
                </h2>
                <p className="text-gray-600">
                    Diferente de muitas plataformas, o iMenu não cobra mensalidade, taxa
                    por pedido ou planos obrigatórios. O restaurante cria e utiliza o
                    cardápio digital gratuitamente, sem risco ou compromisso financeiro.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Ideal para quem está começando
                </h2>
                <p className="text-gray-600">
                    Restaurantes novos, pequenos negócios e operações de delivery
                    encontram no cardápio digital gratuito uma forma eficiente de
                    profissionalizar o atendimento sem aumentar custos fixos.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Compartilhe facilmente com seus clientes
                </h2>
                <p className="text-gray-600">
                    Após criar o cardápio digital gratuito, você pode compartilhar o link
                    no WhatsApp, Instagram, Google ou imprimir um QR Code para uso no
                    estabelecimento.
                </p>
            </section>

            <section>
                <h2 className="text-2xl font-bold mb-4">
                    Checklist antes de divulgar o cardápio
                </h2>
                <p className="text-gray-600 mb-4">
                    Antes de publicar o link, faça um pedido de teste pelo celular e
                    confira os pontos que mais geram dúvidas no atendimento:
                </p>
                <ul className="space-y-2 text-gray-600 list-disc list-inside">
                    <li>preços, tamanhos e adicionais estão fáceis de entender;</li>
                    <li>itens indisponíveis não aparecem como disponíveis;</li>
                    <li>telefone, endereço, horários e formas de pagamento estão corretos;</li>
                    <li>o pedido chega completo e pode ser confirmado sem retrabalho.</li>
                </ul>
                <p className="text-gray-600 mt-4">
                    Para o salão ou materiais impressos, você também pode criar um código
                    na nossa <a className="text-blue-500 underline" href="/ferramentas/gerador-qr-code-cardapio">ferramenta gratuita de QR Code</a>.
                </p>
            </section>
        </SeoPage>
    );
}
