# Summary


- [To Do](#to-do)
- [Feature List](#feature-list)

#### Macro
- [Funnels & User Stories](#funnels--user-stories)
- [Roadmap](#roadmap)
- [Product Positioning](#product-positioning)


---
<br>

# To Do

- Add Jest to the Tech Stack for Unit testing only
    - bring the Py scripts to here so you're able to run manual tests
(solidify for future branch pulls, documentation for testing?)

## Backlog
- add localStorage on cartStore.ts to persist cart
- Move all this stuff to a proper To Do + Roadmap APP
- Add unitary tests (there are some Py scripts)
- Change all tech infrastructure emails to only 1 centralized new gmail



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
| Feature              | Status    | Description / Purpose                                                                  |
|----------------------|-----------|----------------------------------------------------------------------------------------|
| Database Structuring | Waiting   | Go through all Features and Re-structure the DB and Tables according to what's needed. |
|                      | Waiting   |                                                                                        |

### UX
- Prototype everything based in all features on Figma

### Back-End
| Feature                         | Status   | Description / Purpose                                                                                                                                                                                                                                |
|---------------------------------|----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Add Restaurant                  | Waiting  | add restaurant with working URL. also option to delete it                                                                                                                                                                                            |
| iFood Sync & Update             | Waiting  | Sync iFood to request their Menu (categories, items, prices, weight, etc). This should also Update periodically, so it's a forever-long sync. If you need to update the Database, do so, and tell everyone. Run tests as well and fix what's needed. |
| Average Estimated Delivery Time | Waiting  | Automatic (or manual, restaurants can change), set this to DB, displays on user checkout or somewhere else (ifood)                                                                                                                                   |
| withdraw $, show balance        | Waiting  | Panel + Admin can withdraw (idk how that'll work)                                                                                                                                                                                                    |
| METRICS                         | Waiting  | Implement all metrics TRACKING within the CORE FUNNEL. There may be a smarter way than just adding all that to a Table, cuz the tables itself already are the data.                                                                                  |
|                                 | Waiting  |                                                                                                                                                                                                                                                      |

### Front-End
> Rough Creation of the features. No polishing (UI/UX).

| Feature                    | Status   | Description / Purpose                                                                                                                                                                                                       |
|----------------------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Add all paths (folders)    | Waiting  | According to the screens that the app will have (use ifood)                                                                                                                                                                 |
| Subscribe                  | Waiting  | Sign up, email confirmation, delete account, change email, account settings, etc                                                                                                                                            |
| Menu Items                 | Waiting  | Edit, add, change details, add categories, add images, add videos (if possible on supabase, if not, add to Next Versions Feature List)                                                                                      |
| Share Menu                 | Waiting  | Generate QR Code, generate link (customizeable link name?)                                                                                                                                                                  |
| Cart                       | Waiting  | Add, remove, add quantity, etc                                                                                                                                                                                              |
| User Registration/Checkout | Waiting  | (Low friction) fills delivery/pickup details, completes checkout -> checkout must have payment options including Levar Maquininha                                                                                           |
| Order Panel and Orders     | Waiting  | For the Admin, he can receive orders, confirm it = preparing, and send it and also check as "done". This includes the order panel, with filters by date. Each order must also display the user's phone and name and details |
| Delivery Fee System        | Waiting  | The admin can add complex delivery fee systems (it can get very complex, see BeeFood and iFood as an example). The fee system for the user, is calculated based on his CEP                                                  |
| Menu Dashboard             | Waiting  | User can disable items quickly, change prices, etc (ideally this would be 100% synces with ifood, maybe he could disable and enable the ifood sync)                                                                         |
| Customize Menu             | Waiting  | Category order, add image, banner, etc (maybe this is the normal view for the Admin instead of making this another page, see ifood)                                                                                         |
| Basic Dashboard            | Waiting  | Sales, date filters, 1 graph                                                                                                                                                                                                |
|                            | Waiting  |                                                                                                                                                                                                                             |

### UI (Photoshop) and Polish
- When it's all done, add all the pages we have here. Each page is a task. Probably making layouts and the "base" animations, colors, etc we'll use comes before that.
- *Separate tasks between UI (animations, fluf) and UX (confirmation messages, loading states, etc (user flow))

### Deploy
- Switch Authentication > URL Configuration > Site URL (https://supabase.com/dashboard/project/mjogdsnxbwhbqcoijrwt/auth/url-configuration
- change .env stuff
- Explain and document for team about changing .envs and tunneling.

## Feature List for Next Versions (Future)
- Create multiple accounts with different levels, like admin, counter, kitchen, etc
- Add Motoboy location tracking
- Add Upsell feature (just like iFood)
- Instructions: Make it so the menu system itself give next instructions for it's admins, like "add a video to this best selling product to get ~15% more sales!" <- this step is very hard to implement, includes 1. WE gotta know what they have to do and 2. NOT filling them with multiple tasks, make it zero friction a the start and then keep adding new tasks
- Delivery Fee BEFORE CEP -> currently it's after CEP, make it before, with location APIs.
- Advanced Admin Dashboard
- All the Kitchen/Counter Staff user Stories + integration with FAX and printers (recibo, papelzinho do pedido na cozinha, etc) <- hard
- (wonders) Whatsapp notification for delivery: Admin receiveis it when it's paid, user receives it when it's near them or ready
- Checkout must pull information from browser and INTEGRATE with everything we can to make the transaction as smooth as possible
- AI menu photo/pdf scanning to app





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
- 
**Pain Points:**
- Too much % for iFood
- Digital Menus also expensive.
- Digital Menus are bad to implement, update, etc.
- Digital Menus
- **Currently, doing local research on this topic**

> This is a Lead Magnet for high ticket, revolutionizing business model in the Digital Menu niche. **Our goal is to grow them for free, and then for $**

| Type                         | Description                                                      | Why they matter                                       |
| ---------------------------- | ---------------------------------------------------------------- |-------------------------------------------------------|
| **High-end restaurants**     | 300k – 1M R$/month, design-conscious, want white-glove service   | They bring *big-ticket* revenue (future upsell).      |
| **Medium/small restaurants** |  | They bring *volume*, feedback, and viral growth.      |
