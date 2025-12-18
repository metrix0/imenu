# Summary

- [To Do](#to-do)
- [Feature List](#feature-list)

# To Do

## Brendo

## Rafa

## Joao



---
<br>

# Feature List for V1.0

> Um cardápio digital que vende 20% mais que os outros. (Seu faturamento no digital aumenta 20%)

[Novidade:] Agora não precisamos nos preocupar com os custos do software. Podemos fazer simplesmente o melhor sotware possível.

★: Feature que influencia, mesmo se for MANUAL (OU SEJA, features que o costumer vai ver)
TOP_MENUS: Saipos, Anota ai, Goomer

### **20% More Sales** [Conversion/Ticket] (Mid-Funnel Costumer Features)
| Feature                                             | Owner  | REFERÊNCIA | Description                                                                                                                                                                                     |
|-----------------------------------------------------|--------|------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Proxy Features**                                  | XX     |            | XX                                                                                                                                                                                              |
| ★ Upsell                                            |        |            |                                                                                                                                                                                                 |
| SMART MENU: Automatic Upsell + Bundle + Destaques   |        |            | Automatic Ideas: Has Bundled Stuff Automatically, Has Destaques automatically, upsells automatically, etc.                                                                                      |
| **Enhancements**                                    | XX     |            | XX                                                                                                                                                                                              |
| ★ Search Bar+Filtering+Payment Modal                | João   | iFood      | não pagou no menu -> aparece uma tela "aguardando pagamento no /slug com link pro pagamento" + add upper search bar with categories tabs upon scrolling down on digital menu (jsutr like ifood) |
| ★ Handle All Payments without Link + Refunds System | Brendo | iFood      | handle all payments on website only (no webhook, no other pages) using API.                                                                                                                     |
| (final) METRICS/ERROR LOGGING                       |        |            | Make sure it's all 100% smooth, all metrics, all funnel                                                                                                                                         |
| ★ Meta and Google Pixels                            | João   | Goomer     | working and tested                                                                                                                                                                              |
| ★ Custom domain for the users                       |        |            | acai-da-barra.com <=> imenuapp.com/acaidabarra                                                                                                                                                  |
|                                                     |        |            |                                                                                                                                                                                                 |

(Iterated upon testing, proxy features upon copying others)

### **20% More Sales** [Traffic]
| Feature                        | Owner | REFERÊNCIA | Description                                                                                                                                                                    |
|--------------------------------|-------|------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Funneling and Auto-selling** | XX    |            | *All those also include the connection and Panel stuff (BUT PANEL (owner-side) is not ★)                                                                                       |
| ★ Whatsapp Bot                 | Rafa  | Anotai     | Whatsapp: Costumer Message -> Menu shows up (Menu with Images, or one Image with whole Menu and IDs) (they can order via Whatsapp) (24h free) (Official WhatsApp Business API) |
| ★ Instagram Bot                | Rafa  |            | Ig: Same thing (Meta Graph API)                                                                                                                                                |
| ★ Facebook Bot                 | Rafa  |            | Fb: Same thing (has some features) (Messenger Platform API)                                                                                                                    |
| **Marketing:**                 | XX    |            | *All those also include the connection and Panel stuff                                                                                                                         |
| Button Guides                  |       |            | instagram button, all like goomer, Google My Business: Faça seu Pedido button guide (like goomer)                                                                              |
| (manual)                       |       |            | _Manual: Lookalike Retargeting Campaign for Orders_                                                                                                                            |
| (final) METRICS/ERROR LOGGING  |       |            | Make sure it's all 100% smooth, all metrics, all funnel                                                                                                                        |
|                                |       |            |                                                                                                                                                                                |

### **Feature Gap** (Churn)
| Feature                            | Owner  | REFERÊNCIA        | Description                                                                                                                                                                                          |
|------------------------------------|--------|-------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ★ Whatsapp Notifications           | Rafa   | (acho q n existe) | Whatsapp: Notifications para dono e p/ consumidor. (0.06 R$, at 50 orders/day, 2 messages/order = 180 R$/month/user) (usar ideia do rafael de só enviar pro owner se não ver/confirmar em 5 minutos) |
| ★ Videos and Multiple Images       | Brendo |                   | add videos + add compression to images vides eveerting thats uploaded and convert to webp is that ideal? (TANTO NO PAINEL QUANDO PRO CLIENTE)                                                        |
| (final) ZERO BUGS (Bug list below) |        |                   | TEST EVERYTHING, IN 3 DIFFERENT DEVICES, INCOGNITO, MULTIPLE BROWSERS, BREAK EVERYTHING AND THEN FIX                                                                                                 |
| (final) Infrastructure             |        |                   | FASTEST MENU ALIVE, smooth back and front end loadings and calls (vercel paid plan)                                                                                                                  |
|                                    |        |                   |                                                                                                                                                                                                      |



# Feature Backlog

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
