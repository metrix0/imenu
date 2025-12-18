
> Those are all monthly Cleaned (Monthly Code Review)

# Database
- DUPLICAÇÃO EM MENU-ITEMS em posição
- more duplucation
    - excluir delivered_at
    - apagar is_delivery (se não tiver uso)
- separar database entre menu e restaurante (usuario e dono)
- **DOCUMENTAR E FORMALIZAR** todas as apis (endpoints, request body, response body, erros, etc) num arquivo só (md ou outro)
- passar transformando todo uso de supabase em pages em chamadas de API (especialmente nos componentes do painel/criar)
- arrumar zustands, tipo creationStore deveriaser restaurantDataStore
- transformar tudo em timestampz

# Duplicated features (for Monthly Code Review)

            <main className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
            </main>
and Component Loader

footer do /criar not component (use zustand)

app/painel/disponibilidade nao ta usando o component do tudo salvo salvando...

rafa acho que seus /componentes de endereço nao tao usando a lib geocoding



# Bugs

Da pra chegar até o fim do /criar e no ultimo continuar, o email é invalido
arrumar loadings no painel
partially fixed, ideal would be user finishes register through /criar on phone > !!!!! SE O usuário entrar pelo mobile, registrar, ele cai no /criar, e fica uma bosta, mas se ele logar pelo pc, ele cai direto no painel e não finaliza o /criar

on mobile, you can get stucked in a page, because sometimes the "scroll up or down" fills the fucking vision.
Also customize mobile, like, colors if we can.


ainda da pra acessar o /criar mesmo logado e ja criado (criar um step na database? se null, acabou, se 1, 2, 3, ou 4, parou na etapa)


autofill nos forms de endereço

plmd arruma a porra do input do cardapio
ainda ta bugado o drag, n consigo selecionar input

slug editavel + arrumar os números (só precisa gerar se não existir o nome (no futuro vamos precisar verificar anyway))

add 4k resolutionm (easy, just ctrl f 2xl)

Bairro não salva no zustand persist

- Mobile responsiveness NOS BROWSERS do mobile. (teclado subindo, autofill, varias resolucoes, etc)

tirar o número aleatorio do slug, só colocar se for necessário (testar se "slug ja usada"), usuário tb pode trocar

Custom domain for the users

Wpp pessoal e wpp restaurant diferent saas login page change number as wll