# Summary


- [To Do](#to-do)
- [Feature List](#feature-list)

#### Macro
- [Funnels & User Stories](#funnels--user-stories)
- [Roadmap](#roadmap)
- [Product Positioning](#product-positioning)


---
<br>`

# To Do

- "este não é o qrcode para mesa" QR Code gen
- termos de uso
- ~~Start waitlist acquisition~~ | ✅J

JOAO
- mudar o email que o código é enviado supabase auth
- (depois do Front/Back pronto) consolidar toda UX 
- pedido minimo (no criar e no painel (em algum componente))
- ver se tem como pacar pelo nosso side API mercado pago.
- organizar pasta components
- menu da esquerda ficanddo gigante
- adicionar mais botões CTA landing page, email landing page.
- corrigir o mercado pago pagando e deixando como "pago" na parada
- ao inserir cep, automaticamente já calcuala a taxa (sem botão) (testar com autofill)
- ao adicionar algo na sacola volta pro cardapio, não vai pra sacola.
- ao voltar da sacola, tem que carregar tudo dnv? pq?
- botão do whatsapp é só pra dono dde restaurante (nao no cardapio)
- adicionar item vira uma rota, não uma página. Criar componente pra adicionar item
- complemento (opcional) no cadastro endereço
- Adicionar Nome do Cardápio na 4° parte cadastro restaurante
- trocar ordem do grafico com pagamento no painel/financeiro


## Backlog

`

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
| Error Logging                   | JOAO          | PostHog Error %/n  logging                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
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
- mobile error message for dashboard | JOAO (mobile)

### Deploy
- Switch Authentication > URL Configuration > Site URL (https://supabase.com/dashboard/project/mjogdsnxbwhbqcoijrwt/auth/url-configuration
- change .env stuff
- Explain and document for team about changing .envs and tunneling.

### Tests
- Test client side routing (no refresh on page changes)

## Feature List for Next Versions (Future)
- melhorar sessões de usuários, cookies, etc
- Create multiple accounts with different levels, like admin, counter, kitchen, etc
- Add Motoboy location tracking
- Add Upsell feature (just like iFood)
- MOBILE RESPONSIVENESS + mobile browsers responsiveness (bar color, hide, etc)
- Instructions: Make it so the menu system itself give next instructions for it's admins, like "add a video to this best selling product to get ~15% more sales!" <- this step is very hard to implement, includes 1. WE gotta know what they have to do and 2. NOT filling them with multiple tasks, make it zero friction a the start and then keep adding new tasks
- Delivery Fee BEFORE CEP -> currently it's after CEP, make it before, with location APIs.
- Advanced Admin Dashboard
- All the Kitchen/Counter Staff user Stories + integration with FAX and printers (recibo, papelzinho do pedido na cozinha, etc) <- hard
- (wonders) Whatsapp notification for delivery: Admin receiveis it when it's paid, user receives it when it's near them or ready
- Checkout must pull information from browser and INTEGRATE with everything we can to make the transaction as smooth as possible
- AI menu photo/pdf scanning to app
- This should also Update periodically, so it's a forever-long sync. <- ifood sync
- Marketplace: Be able to display all stores in a search with filters.
- separate imenu.com and portal.imenu.com
- integration tests
- add a guide on how to add the imenu link to google maps restaurant gmb (how can they share the link better)
- Live Notifications of orders on whatsapp or app




---
<br>

# Funnels & User Stories
> Product Delivery related funnels

## Core Funnel

```
0. Landing Page

1. Subscription
   └── Restaurant signs up and creates account

2. Activation
   └── Publishes menu
      └── iFood Syncing or AI scanned

Client Flow
   ├── 1. Enters restaurant menu (via QR or link)
   ├── 2. Adds item(s) to cart
   ├── 3. Fills delivery/pickup details
   ├── 4. Completes checkout
   └── 5. Pays (Pix, card, Mercado Pago)

3. Order Reception
   ├── System notifies restaurant in real time (must get notified. Whatsapp?)
   └── Order appears as “New” or “Pending confirmation”

4. Order Acceptance
   ├── Staff accepts order (marks “preparing”)
   └── Optionally sets estimated prep time

5. Order Fulfillment

6. Deposit the $
```
## User Stories

### Restaurant Owner
1. I want to costumize exactly what I'm buying (images, videos, weight, everything)
2. I want to be able to upsell.
3. I want the menu to give me exact instructions on what to do to make it sell more.
4. I want to be able to add my complex delivery fees.
5. I want to be able to have schedule open/closed timings, being able to open/close at any time.
6. I want different access levels for Admin and Counter.
7. I want to have categories in the menu
8. I want to be able to disable menu items quickly, if possible, automated.
9. I want to upload restaurant logo and banner.
10. I want to see daily sales, and all data I can.

### Kitchen/Counter Staff
1. I want to see a live list of orders I have to prepare/send to kitchen.
2. I want to update the order status.
3. I want to search and filter orders.
4. I want to reopen/mark an order as delivering/picked up.

### Costumer
1. I want to enter via QR Code or Link. No apps needed.
2. I want my information to be pulled instantly (credit card, location, etc)
3. I want to see total costs, with delivery fees and everything in realtime.
4. I want to see all states of my order: Pending, paid, preparing, delivering.
5. I want to be notified when the order ready, and when it's near.
6. I want the restaurant to be able to contact me.

### Platform Owner
1. I want to see all platform-level metrics.
2. I want to verify system health.


---
<br>

# Roadmap
1. MVP (1.5 mo)

**GOAL:** Gain Traction (Hypothesis Proved)

| 5W2H         | Description              | 
|--------------|--------------------------|
| **What**     | **Good Core Experience** | 
| When         | 1.5 Months               | 
| Who          | Carlos (Avatar)          | 
| Where        | Whatsapp Cold DM         | 
| **Why**      | **Prove hypothesis**     | 
| **How**      | **Gathering Data**       | 
| **How Much** | **40% Activation Rate**  | 


2. Beta

**GOAL:** To enhance everything: Friction, Data, Numbers, Conversion.

Increasing Market Fit and **Changing the product positioning to target Medium-High ticket costumers** may be ideal.

3. Market Ready...

---
<br>

# Product Positioning

## Avatar (Brazil)
Carlos:
- Restaurant Owner
- 100k R$/month Revenue
- 32 years old
- Staff count: 8
- Medium Tech Familiarity

**Pain Points:**
- Primary Pain (urgent): iFood fees killing margins (30%+). 
- Secondary Pain: Existing digital menus are clunky, costly, or outdated. 
- Hidden Pain: Feels dependent and powerless in his own business. 
- False Belief: Thinks “good tech = expensive or complex.”
- Frustration → “iFood is eating my profit.”

> This is a Lead Magnet for high ticket, revolutionizing business model in the Digital Menu niche. **Our goal is to grow them for free, and then for $**

| Type                         | Description                                                    | Why they matter                                       |
| ---------------------------- |----------------------------------------------------------------|-------------------------------------------------------|
| **High-end restaurants**     | 300k – 1M R$/month, design-conscious, want white-glove service | They bring *big-ticket* revenue (future upsell).      |
| **Medium/small restaurants** |                                                                | They bring *volume*, feedback, and viral growth.      |
