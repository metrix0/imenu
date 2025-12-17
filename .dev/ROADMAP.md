# Summary

- [To Do](#to-do)
- [Feature List](#feature-list)

---
<br>

# To Do

## Brendo

## Rafa

## Joao






---
<br>

# Feature List
> Based on Funnels & User Stories. iFood inspiration UI/UX, Figma for UX. Make sure features work 100%



## Feature List for V1.0

> Um cardápio digital que vende 20% mais que os outros. (Seu faturamento no digital aumenta 20%)

[Novidade:] Agora não precisamos nos preocupar com os custos do software. Podemos fazer simplesmente o melhor sotware possível.

TOP_MENUS: Saipos, Anota ai, Goomer

### **20% More Sales** [Conversion] (Mid-Funnel Costumer Features)
| Feature                                           | Owner | Description                                                                                                                                                                                     |
|---------------------------------------------------|-------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Proxy Features**                                | XX    | XX                                                                                                                                                                                              |
| SMART MENU: Automatic Upsell + Bundle + Destaques |       | Automatic Ideas: Has Bundled Stuff Automatically, Has Destaques automatically, upsells automatically, etc.                                                                                      |
| **Enhancements**                                  | XX    | XX                                                                                                                                                                                              |
| Search Bar+Filtering+Payment Modal                |       | não pagou no menu -> aparece uma tela "aguardando pagamento no /slug com link pro pagamento" + add upper search bar with categories tabs upon scrolling down on digital menu (jsutr like ifood) |
|                                                   |       |                                                                                                                                                                                                 |

(Iterated upon testing, proxy features upon copying others)

### **20% More Sales** [Traffic]
| Feature                        | Owner | Description                                                                                                                                                                    |
|--------------------------------|-------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Funneling and Auto-selling** | XX    | *All those also include the connection and Panel stuff                                                                                                                         |
| Whatsapp Bot                   |       | Whatsapp: Costumer Message -> Menu shows up (Menu with Images, or one Image with whole Menu and IDs) (they can order via Whatsapp) (24h free) (Official WhatsApp Business API) |
| Instagram Bot                  |       | Ig: Same thing (Meta Graph API)                                                                                                                                                |
| Facebook Bot                   |       | Fb: Same thing (has some features) (Messenger Platform API)                                                                                                                    |
| **Marketing:**                 | XX    | *All those also include the connection and Panel stuff                                                                                                                         |
|                                |       | instagram button, all like goomer,   Google My Business: Faça seu Pedido button guide (like goomer)                                                                            |
|                                |       | _Manual: Lookalike Retargeting Campaign for Orders_                                                                                                                            |

### **Feature Gap** (Churn)
| Feature                    | Owner | Description                                                                                                          |
|----------------------------|-------|----------------------------------------------------------------------------------------------------------------------|
| Whatsapp Notifications     |       | Whatsapp: Notifications para dono e p/ consumidor. (0.06 R$, at 50 orders/day, 2 messages/order = 180 R$/month/user) |
| Videos and Multiple Images |       | add videos + add compression to images vides eveerting thats uploaded and convert to webp is that ideal?             |
| ZERO BUGS (Bug list below) |       | TEST EVERYTHING, IN 3 DIFFERENT DEVICES, INCOGNITO, MULTIPLE BROWSERS, BREAK EVERYTHING AND THEN FIX                 |
| Infrastructure             |       | FASTEST MENU ALIVE, smooth back and front end loadings and calls (vercel paid plan)                                  |
|                            |       |                                                                                                                      |



# Feature Backlog

### CORE FUNNEL:

#### Restaurant Owner

#### Costumer
- handle all payments on website only (no webhook, no other pages) using API.

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
