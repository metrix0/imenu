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
> Based on Funnels & User Stories
## MVP Feature List
> All features are just ROUGHLY their category, not 100% necessarily.

- **What to add in this feature?** Copy it's structure from a common app/site. Eg: You can open iFood to see how their Cart feature is. This is important for Database, Front-end and Back-end.
- **Where to add this feature?**: Check the folders on /app, pick a path there. They're all layed out already. Also check the UX result in Figma.
- Mobile First for real
- After finishing features, test them and make sure they work 100%.

### Database
| Feature              | Status  | Description / Purpose                                                                  |
|----------------------|---------|----------------------------------------------------------------------------------------|
| Database Structuring | ✅J     | Go through all Features and Re-structure the DB and Tables according to what's needed. |
|                      | Waiting |                                                                                        |

### UX
- ~~Finish ALL UX (end product flow) + folder paths~~ | ✅J
- ~~Update list based on UX iFood (+All PTBR)~~ | ✅J
- ~~Testes (Jest e py + documentação) e diretórios~~ | ✅J

### Back-End
| Feature                         | Status        | Description / Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
|---------------------------------|---------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Add Restaurant                  | ✅R            | add restaurant with working URL. also option to delete it                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| iFood Sync & Update             | J🟨B-Postponed | Sync iFood to request their Menu (categories, items, prices, weight, etc).  If you need to update the Database, do so, and tell everyone. Run tests as well and fix what's needed.                                                                                                                                                                                                                                                                                                              |
| Average Estimated Delivery Time | ✅B            | Automatic (or manual, restaurants can change), set this to DB, displays on user checkout or somewhere else (ifood)   (automatic based on the time they take)                                                                                                                                                                                                                                                                                                                                    |
| withdraw $, show balance        | ✅R            | quanto tem $ quanto fez API / withdrawal wil work with manual payments. Every monday (add it in a database so we know what to pay) ! Panel + Admin can withdraw (idk how that'll work)                                                                                                                                                                                                                                                                                                          |
| METRICS                         | BRENDO        | Also involves testing it > We'll use POSTHOG, a tool that we implement in our code and we can add stuff like posthog.capture('event'), giving us the ability to capture all needed events. You should also implement the capture events in all CORE FUNNEL RELATED STUFF, if something is not ready yet, add here on TODO > Implement all metrics TRACKING within the CORE FUNNEL. There may be a smarter way than just adding all that to a Table, cuz the tables itself already are the data. |
| Error Logging   XXX claritty?                 | JOAO          | PostHog Error %/n  logging                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
|                                 | Waiting       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
### Front-End
> Rough Creation of the features. No polishing (UI/UX).


| Feature                    | Status  | Description / Purpose                                                                                                                                                                                                                                                                       |
|----------------------------|---------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Arrumar paths              | B R J   | de acordo UX                                                                                                                                                                                                                                                                                |
| Subscribe                  | ✅R      | Sign up, email confirmation, delete account, change email, account settings, etc                                                                                                                                                                                                            |
| Menu Items                 | ✅B      | Edit, add, change details, add categories, add images, add videos (if possible on supabase, if not, add to Next Versions Feature List)                                                                                                                                                      |
| Share Menu                 | ✅R      | Generate QR Code, generate link (customizeable link name?)                                                                                                                                                                                                                                  |
| Cart                       | ✅R      | Add, remove, add quantity, etc                                                                                                                                                                                                                                                              |
| User Registration/Checkout | ✅R      | (Low friction) fills delivery/pickup details, completes checkout -> checkout must have payment options including Levar Maquininha. ! usar Mercado Pago API <- mandar credenciais.txt com credenciais de teste      (idealmente, seria feito 100% no nosso site (tem como MP pagar por API?) |
| Menu Items                 | ✅B      | Menu pro user                                                                                                                                                                                                                                                                               |
| Order Panel and Orders     | ✅B      | For the Admin, he can receive orders, confirm it = preparing, and send it and also check as "done". This includes the order panel, with filters by date. Each order must also display the user's phone and name and details                                                                 |
| Delivery Fee System        | ✅R      | The admin can add complex delivery fee systems (it can get very complex, see BeeFood and iFood as an example). The fee system for the user, is calculated based on his CEP       <- ver como é feito no ifood                                                                               |
| Menu Dashboard             | ✅B      | User can disable items quickly, change prices, etc (ideally this would be 100% synces with ifood, maybe he could disable and enable the ifood sync)                                                                                                                                         |
| Customize/CREATE Menu      | ✅B      | Category order, add image, banner, etc (maybe this is the normal view for the Admin instead of making this another page, see ifood)                                                                                                                                                         |
| Basic Dashboard            | ✅R      | Sales, date filters, graph. Add a section with payouts:  semana 03/11/2025-10/11/2025 (segunda a segunda sempre)    R$ 250     ⏳ Pendendo (ou ✅ Pago)    < depende da função withdraw                                                                                                       |
| Support                    | ✅R      | Botão flutuante no canto inferior direito. No clique ele detecta o tipo de aparelho que ta abrindo, se for um celular, manda direito pro https://wa.me/${phone}?text=${message}, se for um PC, gera um QR code com https://wa.me/${phone}?text=${message}, mostrando o número de contato    |
| Landing Pages              | Waiting | Pro dono de restaurante e (base pro app?)                                                                                                                                                                                                                                                   |
| Menu para Carrinho         | ✅R      |                                                                                                                                                                                                                                                                                             |
|                            | Waiting |                                                                                                                                                                                                                                                                                             |

### UI (Photoshop) and Polish
- ~~Basic UI Concept~~ | ✅J
- ~~LP Mockup~~ | ✅J
- ~~Layouts + Components~~ | ✅J
- Make sure UX is 10/10, before moving on

| Page                                 | Status | Details                                   |
|--------------------------------------|--------|-------------------------------------------|
| /restaurante/criar/localizacao       | R      | iFood + PC, no Mobile (usar components)   |
| /restaurante/criar/tempo-e-taxa      | R      | iFood + PC, no Mobile                     |
| /restaurante/criar/disponibilidade   | R      | iFood + PC, no Mobile                     |
| /restaurante/criar/cardapio          | R      | iFood + PC, no Mobile                     |
| /restaurante/criar/info              | R      | iFood + PC, no Mobile                     |
| /restaurante/criar/info/OTP          | R      | iFood + PC, no Mobile                     |
| /painel                              | R      | iFood + PC, no Mobile (usar components)   |
| /painel/financeiro                   | R      | iFood + PC, no Mobile                     |
| /painel/configurações                | R      | iFood + PC, no Mobile                     |
| /painel/configurações/integrações    | J      | iFood + PC, no Mobile                     |
| /painel/configurações/nova-senha     | R      | iFood + PC, no Mobile                     |
| /painel/cardapio                     | B      | iFood + PC, no Mobile                     |
| /painel/disponibilidade              | R      | iFood + PC, no Mobile                     |
| /painel/tempo-e-taxa                 | R      | iFood + PC, no Mobile                     |
| /painel/loja                         | B      | iFood + PC, no Mobile                     |
| /(nome-do-restaurante)               | B      | iFood + Mobile > PC                       |
| /(nome-do-restaurante)/[id]          | B      | iFood + Mobile > PC                       |
| /(nome-do-restaurante)/[id]/info     | B      | iFood + Mobile > PC                       |
| /(nome-do-restaurante)/[id]/checkout | B      | iFood + Mobile > PC                       |

- Landing Page (Mobile & PC) + video | JOAO (mobile)
- ~~mobile error message for dashboard~~ | JOAO (mobile)

#### Stage 2 UX/UI/Polishing:
- TESTING FLOWS (back and forth, up and down) *PC 1920x1080 & 1366x768, MOBILE (resolução do figma)
  - Creation Flow (/restaurante) & going to Panel [Zustand + Pooling]
  - Panel Flow 1 (/painel) [Zustand + Realtime]
  - Panel Flow 2 (/painel) [Zustand + Realtime]
  - Menu Flow (/[slug]) [Zustand (storing cart data) + Pooling]
  
*The step above must ensure: Zustand, Realtime and Pooling when it's the case.

- FIX ALL BUGS (registered on TO DO)
- Fill checklist
  - Uses our UI components preferably (buttons, inputs, etc)
  - Uses our lib preferably (supabaseClient, creationStore, etc)
  - Is this ready for release? Make it ready!

### Deploy
- Switch Authentication > URL Configuration > Site URL (https://supabase.com/dashboard/project/mjogdsnxbwhbqcoijrwt/auth/url-configuration
- change .env stuff
- Explain and document for team about changing .envs and tunneling.
- mudar o email que o código é enviado supabase auth
- LIBERAR ROTA api/restaurant/count remover o =15 e max 10 rests


### Tests
- Test client side routing (no refresh on page changes)

## Feature List for Next Versions (Future)
- !!! ifood sync
- facilitar p usuario colocar foto (cortar, etc), falar resoluão dos banners, etc
- melhorar sessões de usuários, cookies, zustand, etc
- Create multiple accounts with different levels, like admin, counter, kitchen, etc
- Add Motoboy location tracking
- Add Upsell feature (just like iFood)
- fazer categoria destaques no menu digital ser automatico ou deixar o user cllicar numa estrelinha no
- MOBILE RESPONSIVENESS + mobile browsers responsiveness (bar color, hide, etc)
- Instructions: Make it so the menu system itself give next instructions for it's admins, like "add a video to this best selling product to get ~15% more sales!" <- this step is very hard to implement, includes 1. WE gotta know what they have to do and 2. NOT filling them with multiple tasks, make it zero friction a the start and then keep adding new tasks
- Delivery Fee BEFORE CEP -> currently it's after CEP, make it before, with location APIs.
- Advanced Admin Dashboard
- add upper search bar with categories tabs upon scrolling down on digital menu (jsutr like ifood)
- otimizar registro (só email) - make /restaurante -> /restaurante/registrar (apenas email) -> /restaurante/criar/... -> /criar/info
- handle all payments on website only (no webhook, no other pages) using API.
- All the Kitchen/Counter Staff user Stories + integration with FAX and printers (recibo, papelzinho do pedido na cozinha, etc) <- hard
- (wonders) Whatsapp notification for delivery: Admin receiveis it when it's paid, user receives it when it's near them or ready
- Checkout must pull information from browser and INTEGRATE with everything we can to make the transaction as smooth as possible
- AI menu photo/pdf scanning to app
- This should also Update periodically, so it's a forever-long sync. <- ifood sync
- Marketplace: Be able to display all stores in a search with filters.
- separate imenu.com and portal.imenu.com
- integration tests
- safely increase google API geocoding limits + also track errors in usage
- add a guide on how to add the imenu link to google maps restaurant gmb (how can they share the link better)
- Live Notifications of orders on whatsapp or app
- add videos + add compression to images vides eveerting thats uploaded and convert to webp is that ideal?
- não pagou no menu -> aparece uma tela "aguardando pagamento no /slug com link pro pagamento"


