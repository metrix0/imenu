# Summary

- [To Do](#to-do)
- [Feature List](#feature-list)

---
<br>

# To Do

## Brendo
Ver no whatsapp, meus arquivos deram problema

## Rafa
- **corrigir erros Txt**
- 
- esqueci minha senha no /login
- mudar email funcionando (manda um email de confirmação pro email NOVO) E PODER ALTERAR TELEFONE (n precisa verificar)
- Adicionar verificação de Auth (pode botar no layout) (local browser data) em todas as páginas que precisam de Auth (painel, criar restaurante, etc)
- facilitar p usuario colocar foto (cortar, etc), falar resoluão dos banners (colocar um texto embaixo em algum lugar falando a resoução do banner, inventa uma), etc (SÓ NA LOJA E PAIENL)
- se usuário (ja confirmado por código OTP) esta no /criar, mandar pro /painel


## Joao

- **corrigir erros txt**
- update cart modal upon geolocation function from rafa + colocar placeholder.png item ao dicionar novo item
- /criar e /painel 1920 adaptation (responsividade)
- DEPLOY VERCEL LIMITADO GITHUB NAO commits fack
- rate limit, DB backups, remover bibliotecas ruins (mostra no deploy vercel)

- ### deploy

- só deixar no max 10 restaurantes na DB
- domínio
- Verificar e garantrir o posthog
- Adicionar sentry (tentar em tudo)
- descubrir a resolução certa do banner e mudar lá
- Preencher Terms e condições +  /restaurante/dados 
- mobile adapt supportbutton and ? buttyon

- ### costumer


DATABASE
- DUPLICAÇÃO EM MENU-ITEMS em posição
- more duplucation
  - excluir delivered_at 
  - apagar is_delivery (se não tiver uso)
- separar database entre menu e restaurante (usuario e dono)
- **DOCUMENTAR E FORMALIZAR** todas as apis (endpoints, request body, response body, erros, etc) num arquivo só (md ou outro)
- passar transformando todo uso de supabase em pages em chamadas de API (especialmente nos componentes do painel/criar)
- arrumar zustands, tipo creationStore deveriaser restaurantDataStore
- transformar tudo em timestampz

## Backlog

---
<br>

# Feature List
> Based on Funnels & User Stories. iFood inspiration UI/UX, Figma for UX. Make sure features work 100%


### Deploy
- GET DOMAIN
- Switch Authentication > URL Configuration > Site URL (https://supabase.com/dashboard/project/mjogdsnxbwhbqcoijrwt/auth/url-configuration
- change .env stuff
- max 10 restaurantes, deixar uns 5 + LIMPAR DB com coisa de teste (manter burger fodas)
- mudar o email que o código é enviado supabase auth
- get supabase/vercel plans
- disable automatic github deploy


## Feature List for Next Versions (Future)

### CORE FUNNEL:

#### Restaurant Owner

#### Costumer
- Mobile responsiveness NOS BROWSERS do mobile. (teclado subindo, autofill, varias resolucoes, etc)
- add upper search bar with categories tabs upon scrolling down on digital menu (jsutr like ifood)
- handle all payments on website only (no webhook, no other pages) using API.
- Checkout must pull information from browser and INTEGRATE with everything we can to make the transaction as smooth as possible
- não pagou no menu -> aparece uma tela "aguardando pagamento no /slug com link pro pagamento"
- add videos + add compression to images vides eveerting thats uploaded and convert to webp is that ideal?

#### Both



### NON-CORE FUNNEL (or too big)
- (vamos ver a taxa de pedidos que não foram aceitos, se for alta) -> Live Notifications of orders on whatsapp or **app** para pedidos não aceitos por mais de 8-10 minutos + o cliente recebe um whats falando que o pedido está a caminho
- deixar o usuário mudar a slug dele (e testar ver se ja existe)
- Add: "those are your best upsells, add them to your menu to increase sales by X%" CLICK HERE (button to add upsell to all items) <- have a "UPSELL" menu tab, where they can adjust which items are going to be upsells. Just like the ifood sacola, but on the item modal, like an upsell.
- Add Upsell feature NA SACOLA "peça também" (just like iFood)
- Create multiple accounts with different levels, like admin, counter, kitchen, etc
- Add Motoboy location tracking
- fazer categoria destaques no menu digital ser automatico ou deixar o user cllicar numa estrelinha no
- Instructions: Make it so the menu system itself give next instructions for it's admins, like "add a video to this best selling product to get ~15% more sales!" <- this step is very hard to implement, includes 1. WE gotta know what they have to do and 2. NOT filling them with multiple tasks, make it zero friction a the start and then keep adding new tasks
- Delivery Fee BEFORE CEP -> currently it's after CEP, make it before, with location APIs.
- Advanced Admin Dashboard
- All the Kitchen/Counter Staff user Stories + integration with FAX and printers (recibo, papelzinho do pedido na cozinha, etc) <- hard
- This should also Update periodically, so it's a forever-long sync. <- ifood sync
- Marketplace: Be able to display all stores in a search with filters.
- separate imenu.com and portal.imenu.com
- integration tests
- add a guide on how to add the imenu link to google maps restaurant gmb (how can they share the link better)
- whole web app AI assistant
- COMPONENTIZAR MUITAS MAIS COISAS p/ facilitar responsividade



# Duplicated features

            <main className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
            </main>
and Component Loader

footer do /criar not component (use zustand)

app/painel/disponibilidade nao ta usando o component do tudo salvo salvando...

rafa acho que seus componentes de endereço nao tao usando a lib geocoding

# Bugs

Da pra chegar até o fim do /criar e no ultimo continuar, o email é invalido
arrumar loadings no painel