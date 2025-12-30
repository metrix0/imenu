
> Those are all monthly Cleaned (Monthly Code Review)



# Duplicated features (for Monthly Code Review)

            <main className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
            </main>
and Component Loader

footer do /criar not component (use zustand)

app/painel/disponibilidade nao ta usando o component do tudo salvo salvando...

rafa acho que seus /componentes de endereço nao tao usando a lib geocoding


CTRL+SHIFT+F: setRestaurantId <- duplicado setar o Zustand do restid




# Non-priority to 20% Bugs (Bugs that we can fix manually for the client, or he won't even face it)

arrumar loadings no painel (usar o tabs loading component)

partially fixed, ideal would be user finishes register through /criar on phone > !!!!! SE O usuário entrar pelo mobile, registrar, ele cai no /criar, e fica uma bosta, mas se ele logar pelo pc, ele cai direto no painel e não finaliza o /criar

ainda da pra acessar o /criar mesmo logado e ja criado (criar um step na database? se null, acabou, se 1, 2, 3, ou 4, parou na etapa)

plmd arruma a porra do input do cardapio
ainda ta bugado o drag, n consigo selecionar input

restaurante/criar/cardapio não ta componentizado (fodase)

Whatsapp Pessoal e Whatsapp do Restaurante são diferentes. do restaurante no /loja

/menu não deveria existir, delete-item, insert-item, tudo isso deve estar no items
(front não pode usar db depois do loading)

/auth
Cade as outras apis de auth? Logar, Registrar, Mudar senha, etc
(front não pode usar db depois do loading)

- transformar tudo em timestampz

# Bugs

J:
on mobile (cardapio), you can get stucked in a page, because sometimes the "scroll up or down" fills the fucking vision.
Also customize mobile, like, colors if we can.

mobile cardapio autofill nos forms de endereço

add 4k resolution to everything (easy, just ctrl f 2xl)

Bairro não salva no zustand persist

delivery_fee nao carrega no reload mais menu (provavelmente por causa do bairr)

acompanhar pedido nao mostra taxa de entrega e cupons

**- Mobile responsiveness NOS BROWSERS do mobile. (teclado subindo, autofill, varias resolucoes, etc)**

- sem clarity no (seo)

- "obrigatório" nos subitems ta feio

- as vezes quando reseta a página o botçao continuar ainda fica como "confirmar" do anterior

R:
VOU DELETAR A TABLE menus, tirar todo uso. (pode remover vc mesmo da supabase assim que tira todos usos de "menu")

slug editavel + arrumar os números (só precisa gerar se não existir o nome (no futuro vamos precisar verificar anyway))
tirar o número aleatorio do slug, só colocar se for necessário (testar se "slug ja usada"), usuário tb pode trocar

whatsapp support modal sem animação

NÃO PRECISA CORRIGIR, SÓ NÃO REPETIR: (vou deletar a table tb) /menu não deveria existir, delete-item, insert-item, tudo isso deve estar no items
(front não pode usar db depois do loading)

passa todas as colunas de restaurants para restaurant_owner_settings (ja pasei no  SQL, precisa pasasr no código em si)
outra coisa, quando um pagamento é feito, o restaurante recebe o dinheiro? Tipo aparece pra eles certinho? QUANDO o dinheiro é somado?

B:
(ERro meu, prep time depende de distância) prep_time_min e max, prep_time_source, prep_time_computed_at serão deletados, pode tirar, e tirar a func de calcular (fiz de um jeito diff que fica melhor) (pode deletar da supabase)





AGR OU DPS? (organização, project-health)
- passar transformando todo uso de supabase em pages em chamadas de API (especialmente nos componentes do painel/criar)
- arrumar zustands, tipo creationStore deveriaser restaurantDataStore
*só usar timestampz a partir de agr



IMAGEM DO LUIGI ERRO 

LUGI DISPONIBILIDADE NAO TA APARECENDO ERRO DE NAO TA ABERTO


Acho que faz sentido os pedidos aparecerem em ordem crescente de tempo, não o contrário + bug do -1min + o tempo deve aparecer verde/azul, só ficar vermelho se >5min pra aceitar