export type RestaurantToolDefinition = {
    slug: string;
    name: string;
    title: string;
    metaDescription: string;
    introduction: string;
    calculationTitle: string;
    calculation: string;
    practicalTips: string[];
    faq: Array<{ question: string; answer: string }>;
};

export const RESTAURANT_TOOLS: RestaurantToolDefinition[] = [
    {
        slug: "calculadora-taxas-ifood",
        name: "Calculadora de taxas do iFood",
        title: "Calculadora de taxas do iFood para restaurantes",
        metaDescription:
            "Calcule comissão, pagamento online, mensalidade, custo por pedido e valor líquido estimado do iFood. Compare com pedidos diretos gratuitamente.",
        introduction:
            "Informe o faturamento, o plano e a participação dos pagamentos online para estimar quanto a operação deixa no marketplace e quanto sobra antes dos demais custos do restaurante.",
        calculationTitle: "Como a estimativa das taxas é calculada",
        calculation:
            "A calculadora soma a comissão sobre as vendas, a taxa de pagamento online apenas sobre a parcela paga no aplicativo e a mensalidade quando o faturamento ultrapassa o limite informado. Todos os percentuais e valores podem ser alterados para refletir o contrato real da sua loja.",
        practicalTips: [
            "Confira as condições vigentes no Portal do Parceiro antes de tomar uma decisão.",
            "Compare canais usando o mesmo faturamento, ticket médio e custo de entrega.",
            "Avalie o custo por pedido, não apenas o percentual de comissão.",
        ],
        faq: [
            {
                question: "Qual taxa do iFood devo usar?",
                answer:
                    "Use a comissão, a taxa de pagamento online e a mensalidade que aparecem no contrato ou Portal do Parceiro da sua loja. Os valores podem variar por plano, região e condição comercial.",
            },
            {
                question: "A taxa de pagamento online incide em todos os pedidos?",
                answer:
                    "Não necessariamente. Por isso a calculadora permite informar qual porcentagem do faturamento foi paga dentro da plataforma.",
            },
            {
                question: "A comparação inclui imposto, embalagem e entrega?",
                answer:
                    "Não. Ela compara custos de plataforma e marketplace. Impostos, produção, embalagem, meios de pagamento e logística devem ser analisados separadamente.",
            },
        ],
    },
    {
        slug: "calculadora-preco-de-venda",
        name: "Calculadora de preço de venda e food cost",
        title: "Calculadora de preço de venda para alimentos",
        metaDescription:
            "Calcule o preço de venda de pratos, lanches e bebidas pelo custo da receita, rendimento, embalagem e meta de food cost. Ferramenta gratuita.",
        introduction:
            "Descubra o custo real por porção e um preço de venda coerente com a sua meta de food cost, sem depender de markup escolhido no chute.",
        calculationTitle: "Como calcular preço de venda pelo food cost",
        calculation:
            "Primeiro, o custo total dos ingredientes é dividido pelo rendimento da receita. Embalagem e outros custos variáveis por unidade são somados. O preço sugerido é o custo unitário total dividido pela meta de food cost em formato decimal.",
        practicalTips: [
            "Use fichas técnicas e pese os ingredientes para obter um custo confiável.",
            "Inclua perdas de preparo no custo da receita.",
            "Revise os preços sempre que fornecedores reajustarem insumos importantes.",
        ],
        faq: [
            {
                question: "O que é food cost?",
                answer:
                    "É a participação do custo do alimento no preço de venda. Se um item custa R$ 9 e é vendido por R$ 30, seu food cost é 30%.",
            },
            {
                question: "Qual food cost é ideal?",
                answer:
                    "Não existe um percentual único. A meta depende do tipo de operação, despesas, impostos e margem necessária. Use o resultado como ponto de partida e valide a margem completa.",
            },
            {
                question: "Devo incluir embalagem no cálculo?",
                answer:
                    "Para delivery, sim. A embalagem é um custo variável de cada venda e precisa ser recuperada no preço.",
            },
        ],
    },
    {
        slug: "calculadora-margem-delivery",
        name: "Calculadora de margem para delivery",
        title: "Calculadora de margem de lucro para delivery",
        metaDescription:
            "Calcule margem de contribuição, lucro mensal e ponto de equilíbrio do delivery considerando CMV, embalagem, comissão, taxas e impostos.",
        introduction:
            "Veja quanto cada pedido realmente deixa para pagar os custos fixos e gerar lucro depois de ingredientes, embalagem, comissões, impostos e demais despesas variáveis.",
        calculationTitle: "Margem de contribuição no delivery",
        calculation:
            "A margem de contribuição por pedido é o preço de venda menos todos os custos variáveis da venda. O ponto de equilíbrio divide os custos fixos mensais por essa margem. O resultado mensal estimado multiplica a margem pelos pedidos e desconta os custos fixos.",
        practicalTips: [
            "Separe custos fixos dos custos que crescem a cada pedido.",
            "Calcule a margem por canal, pois marketplace e pedido direto têm custos diferentes.",
            "Não confunda faturamento alto com lucro alto.",
        ],
        faq: [
            {
                question: "Qual a diferença entre margem e markup?",
                answer:
                    "Margem é o que sobra em relação ao preço de venda. Markup é o multiplicador aplicado sobre o custo. Percentuais iguais produzem resultados diferentes.",
            },
            {
                question: "O pró-labore entra no cálculo?",
                answer:
                    "Quando é uma despesa mensal recorrente, inclua o pró-labore nos custos fixos para que o ponto de equilíbrio seja realista.",
            },
            {
                question: "Como calcular a margem de um canal direto?",
                answer:
                    "Zere a comissão do marketplace e informe apenas as taxas de pagamento, entrega subsidiada, impostos e outros custos que existirem naquele canal.",
            },
        ],
    },
    {
        slug: "gerador-qr-code-cardapio",
        name: "Gerador de QR Code para cardápio",
        title: "Gerador de QR Code para cardápio grátis",
        metaDescription:
            "Crie QR Code para cardápio digital grátis, personalize cores e tamanho, teste a leitura e baixe em PNG ou SVG para imprimir.",
        introduction:
            "Cole o link do seu cardápio, escolha o tamanho e gere um QR Code pronto para mesas, embalagens, balcão e materiais impressos.",
        calculationTitle: "Como usar o QR Code no restaurante",
        calculation:
            "O QR Code codifica o endereço do cardápio em uma imagem que pode ser lida pela câmera do celular. Para impressão, prefira SVG ou uma imagem grande, mantenha contraste alto e preserve a margem branca ao redor do código.",
        practicalTips: [
            "Teste o arquivo em mais de um celular antes de imprimir.",
            "Não corte a margem externa do QR Code.",
            "Use um link permanente para não precisar reimprimir o material.",
        ],
        faq: [
            {
                question: "O QR Code gerado expira?",
                answer:
                    "Não. O código continua funcionando enquanto o link informado permanecer ativo.",
            },
            {
                question: "PNG ou SVG: qual formato escolher?",
                answer:
                    "PNG é prático para redes sociais e documentos. SVG mantém nitidez em qualquer tamanho e costuma ser melhor para impressão profissional.",
            },
            {
                question: "Posso usar cores no QR Code?",
                answer:
                    "Sim, mas mantenha bastante contraste entre o código e o fundo. Fundo claro com código escuro é a combinação mais segura.",
            },
        ],
    },
    {
        slug: "gerador-cardapio-digital",
        name: "Gerador de cardápio digital",
        title: "Gerador de cardápio digital grátis",
        metaDescription:
            "Monte um cardápio digital grátis com categorias, produtos, descrições, preços e pedidos pelo WhatsApp. Copie, imprima ou baixe em HTML.",
        introduction:
            "Monte uma versão organizada do seu menu, visualize em tempo real e exporte para HTML, WhatsApp ou PDF. O rascunho fica salvo somente no seu navegador.",
        calculationTitle: "O que um bom cardápio digital precisa ter",
        calculation:
            "Categorias claras, nomes fáceis de entender, descrições objetivas e preços visíveis reduzem dúvidas. Os itens mais importantes devem aparecer primeiro, e o caminho para pedir precisa ser simples em qualquer celular.",
        practicalTips: [
            "Use categorias que o cliente reconhece rapidamente.",
            "Destaque ingredientes, tamanho da porção e diferenciais reais.",
            "Revise telefone, preços e ortografia antes de compartilhar.",
        ],
        faq: [
            {
                question: "Onde o rascunho do cardápio é salvo?",
                answer:
                    "Ele é guardado localmente no navegador do seu dispositivo. Nenhum produto é enviado ao iMenu por esta ferramenta.",
            },
            {
                question: "O arquivo HTML recebe pedidos?",
                answer:
                    "Se você informar um WhatsApp, cada produto terá um botão que abre uma conversa com o nome do item. Para ter link público e gestão de pedidos, crie seu cardápio no iMenu.",
            },
            {
                question: "Como salvar o cardápio em PDF?",
                answer:
                    "Use o botão de impressão e escolha a opção Salvar como PDF na janela do navegador.",
            },
        ],
    },
    {
        slug: "calculadora-ticket-medio",
        name: "Calculadora de ticket médio",
        title: "Calculadora de ticket médio para restaurantes",
        metaDescription:
            "Calcule o ticket médio do restaurante e simule metas, adicionais e aumento de faturamento por pedido. Ferramenta gratuita para delivery.",
        introduction:
            "Calcule quanto cada pedido vale em média e simule o impacto de uma meta de ticket ou de um adicional aceito por parte dos clientes.",
        calculationTitle: "Como calcular ticket médio",
        calculation:
            "O ticket médio é o faturamento do período dividido pela quantidade de pedidos. A simulação de adicional multiplica o valor do adicional pela taxa de aceitação e soma esse valor esperado ao ticket atual.",
        practicalTips: [
            "Compare períodos equivalentes para não confundir sazonalidade com crescimento.",
            "Acompanhe ticket por canal e por turno.",
            "Teste adicionais coerentes, combos e sobremesas sem dificultar o pedido.",
        ],
        faq: [
            {
                question: "Ticket médio alto sempre é melhor?",
                answer:
                    "Não isoladamente. Um ticket maior pode vir acompanhado de menos pedidos ou margem menor. Analise faturamento, frequência e margem juntos.",
            },
            {
                question: "Pedidos cancelados entram no cálculo?",
                answer:
                    "Normalmente não. Use apenas o faturamento e a quantidade de pedidos efetivamente concluídos no mesmo período.",
            },
            {
                question: "Como aumentar o ticket médio?",
                answer:
                    "Combos, complementos relevantes, tamanhos maiores e sugestões no momento certo costumam funcionar melhor do que simplesmente elevar todos os preços.",
            },
        ],
    },
    {
        slug: "calculadora-comissao-delivery",
        name: "Calculadora de comissão de delivery",
        title: "Calculadora de comissão de aplicativo de delivery",
        metaDescription:
            "Calcule comissão, taxa de pagamento, custo fixo, valor líquido e preço necessário em qualquer aplicativo de delivery.",
        introduction:
            "Informe as condições de qualquer canal de delivery para saber o custo total por pedido, o valor líquido recebido e o preço necessário para atingir uma meta líquida.",
        calculationTitle: "Como calcular comissão de delivery",
        calculation:
            "As taxas percentuais são aplicadas ao valor do pedido e somadas aos custos fixos por venda. Para encontrar o preço necessário, a meta líquida e os custos fixos são divididos pelo percentual que resta depois das taxas.",
        practicalTips: [
            "Inclua todas as taxas percentuais cobradas sobre o pedido.",
            "Some custos fixos por transação e subsídios de frete.",
            "Use o valor líquido para comparar aplicativos diferentes.",
        ],
        faq: [
            {
                question: "A comissão é calculada sobre o frete?",
                answer:
                    "Isso depende do contrato e do canal. Confira a base de cálculo no extrato e ajuste os valores da ferramenta para representar seu caso.",
            },
            {
                question: "Como repassar a comissão no preço?",
                answer:
                    "Não basta somar o mesmo percentual ao preço. Para preservar um valor líquido, divida a meta pelo percentual restante após as taxas; a calculadora faz essa conta.",
            },
            {
                question: "Posso comparar marketplace e WhatsApp?",
                answer:
                    "Sim. Use comissão zero no canal direto e informe apenas os custos que realmente existem, como pagamento online ou entrega.",
            },
        ],
    },
    {
        slug: "calculadora-cmv",
        name: "Calculadora de CMV",
        title: "Calculadora de CMV para restaurantes",
        metaDescription:
            "Calcule CMV em reais e percentual, lucro bruto, giro de estoque e diferença para a meta usando estoque inicial, compras, estoque final e vendas.",
        introduction:
            "Meça quanto os produtos consumidos no período custaram e compare o CMV real com a meta do restaurante usando dados de estoque, compras e vendas.",
        calculationTitle: "Fórmula do CMV",
        calculation:
            "CMV é igual ao estoque inicial mais as compras do período menos o estoque final. O CMV percentual divide esse resultado pelas vendas líquidas e multiplica por 100. A qualidade do resultado depende de contagens de estoque consistentes.",
        practicalTips: [
            "Faça o inventário sempre com o mesmo critério e horário de corte.",
            "Registre perdas, consumo interno e transferências.",
            "Investigue diferenças por categoria antes de cortar qualidade ou porção.",
        ],
        faq: [
            {
                question: "O que entra nas compras do período?",
                answer:
                    "Inclua mercadorias e insumos destinados à produção dos itens vendidos, seguindo o mesmo critério usado no estoque inicial e final.",
            },
            {
                question: "CMV e food cost são iguais?",
                answer:
                    "Eles se relacionam, mas não são necessariamente iguais. O CMV mede o consumo real do período; o food cost de ficha técnica estima o custo de um item ou receita.",
            },
            {
                question: "CMV negativo é possível?",
                answer:
                    "Em uma operação normal, não. Geralmente indica erro de inventário, compras ausentes ou períodos de corte diferentes.",
            },
        ],
    },
    {
        slug: "calculadora-preco-combo",
        name: "Calculadora de preço para combo",
        title: "Calculadora de preço de combo para restaurante",
        metaDescription:
            "Monte um combo, calcule desconto percebido, custo, taxas, margem e preço mínimo para proteger a rentabilidade do restaurante.",
        introduction:
            "Some preços e custos dos itens, aplique o desconto desejado e descubra se o combo preserva a margem mínima depois das taxas da venda.",
        calculationTitle: "Como precificar um combo sem perder margem",
        calculation:
            "O preço promocional parte da soma dos preços avulsos menos o desconto. O preço mínimo sustentável considera o custo total, as taxas percentuais e a margem desejada. A recomendação usa o maior desses dois valores.",
        practicalTips: [
            "Combine itens com boa margem e valor percebido alto.",
            "Mostre ao cliente quanto ele economiza em relação aos itens avulsos.",
            "Considere comissão, imposto e embalagem antes de definir o desconto.",
        ],
        faq: [
            {
                question: "Todo combo precisa ter desconto?",
                answer:
                    "Não, mas o cliente precisa perceber conveniência ou vantagem. A economia pode ser pequena quando a combinação já simplifica a escolha.",
            },
            {
                question: "Qual item deve entrar no combo?",
                answer:
                    "Prefira itens complementares, populares e com margem suficiente para sustentar a oferta sem comprometer a operação.",
            },
            {
                question: "Como considerar a comissão do aplicativo?",
                answer:
                    "Some comissão, pagamento online e impostos cobrados como percentual da venda no campo de taxas.",
            },
        ],
    },
    {
        slug: "gerador-descricao-produto-ia",
        name: "Gerador de descrição de produto com IA",
        title: "Gerador de descrição de produto para cardápio com IA",
        metaDescription:
            "Crie descrições de pratos, lanches, pizzas, bebidas e sobremesas em português com IA. Receba três versões e uma descrição curta grátis.",
        introduction:
            "Informe apenas dados verdadeiros do produto e receba três descrições prontas para cardápio, além de uma versão curta e palavras-chave úteis.",
        calculationTitle: "Como escrever uma boa descrição de produto",
        calculation:
            "Uma descrição eficiente explica o que é o produto, destaca ingredientes e diferenciais reais e ajuda o cliente a imaginar sabor, textura e tamanho sem exagerar ou inventar informações.",
        practicalTips: [
            "Informe ingredientes, preparo e tamanho com precisão.",
            "Revise alergênicos e restrições antes de publicar.",
            "Escolha a versão que combina com a voz do seu restaurante.",
        ],
        faq: [
            {
                question: "A IA pode inventar ingredientes?",
                answer:
                    "A ferramenta é orientada a usar somente os dados informados, mas toda resposta de IA deve ser revisada antes da publicação.",
            },
            {
                question: "A descrição substitui a informação de alergênicos?",
                answer:
                    "Não. Alergênicos e restrições exigem conferência humana e informação clara de acordo com a receita e os procedimentos da cozinha.",
            },
            {
                question: "Quais produtos posso descrever?",
                answer:
                    "Pratos, lanches, pizzas, porções, bebidas, sobremesas, combos e outros itens de cardápio.",
            },
        ],
    },
];

export function getRestaurantTool(
    slug: string
): RestaurantToolDefinition | undefined {
    return RESTAURANT_TOOLS.find((tool) => tool.slug === slug);
}

export function getRestaurantToolPath(slug: string): string {
    return `/ferramentas/${slug}`;
}
