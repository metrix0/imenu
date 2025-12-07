# Summary

- [To Do](#to-do)
- [Feature List](#feature-list)

---
<br>

# To Do

## Brendo
Ver no whatsapp, meus arquivos deram problema

## Rafa
oq falamos, meus arquivos deram problema


## Joao

- testar http://localhost:3000/pizzaria-sao-paulo em monitor 1920 e ver se fica estrnaho


- só deixar no max 10 restaurantes na DB
- domínio

- update cart modal upon geolocation function from rafa + colocar placeholder.png item ao dicionar novo item
RAF
- /criar 1920 e 1366 adaptation /painel
- ao inserir cep, automaticamente já calcuala a taxa (sem botão) (testar com autofill)
- complemento (opcional) no cadastro endereço
- trocar ordem do grafico com pagamento no painel/financeiro
- botão salvar no /painel/cardapio
- menu não é criado no registro
- ao adicionar um item, também deve-se criar uma row na table menu-items que coliga as categorias e items (deletar funciona) *OBS DUPLICAÇÃO EM MENU-ITEMS em posição
- animaçao estranha ao editar item
- nao consigo selecionar ao editar item (ele da um drag)
- erro ao editar item
- adicionar close animation no Modal
- Error: Erro ao enviar código: For security purposes, you can only request this after 46 seconds. ao tentar salvar no /criar/caradapio 2 vezds
- se usuário (ja confirmado por código OTP) esta no /criar, mandar pro /painel
- setando pra  Min R$ 0,00
- adicionar algo no painel n aparece  no menu provavelmente pq n linka com menu table

- BRE

- painel: adicionar item vira uma rota, não uma página. pra poder adicionar item na própria pagina que nem ifood

DATABASE
- DUPLICAÇÃO EM MENU-ITEMS em posição
- separar database entre menu e restaurante (usuario e dono)
- **DOCUMENTAR E FORMALIZAR** todas as apis (endpoints, request body, response body, erros, etc) num arquivo só (md ou outro)
- passar transformando todo uso de supabase em pages em chamadas de API (especialmente nos componentes do painel/criar)
- arrumar zustands, tipo creationStore deveriaser restaurantDataStore

## Backlog
- Adicionar verificação de Auth (local browser data) em todas as páginas que precisam de Auth (painel, criar restaurante, etc)

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
- !!! ifood sync
- facilitar p usuario colocar foto (cortar, etc), falar resoluão dos banners, etc
- Live Notifications of orders on whatsapp or app
- o usuário pode compartilhar subcategorias enter itens

#### Consumer
- Mobile responsiveness NOS BROWSERS do mobile. (teclado subindo, autofill, varias resolucoes, etc)
- add upper search bar with categories tabs upon scrolling down on digital menu (jsutr like ifood)
- handle all payments on website only (no webhook, no other pages) using API.
- Checkout must pull information from browser and INTEGRATE with everything we can to make the transaction as smooth as possible
- não pagou no menu -> aparece uma tela "aguardando pagamento no /slug com link pro pagamento"
- add videos + add compression to images vides eveerting thats uploaded and convert to webp is that ideal?

#### Both
- (wonders) Whatsapp notification for delivery: Admin receiveis it when it's paid, user receives it when it's near them or ready
- google API geocoding limits + also track errors in usage



### NON-CORE FUNNEL (or too big)
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