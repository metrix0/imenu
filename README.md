# Summary

> We must be better in every single aspect

- [Tech Stack](#tech-stack)
- [Folder Structure and Explanation](#folder-structure)
- [Database, Pool, Realtime and Auth](#database-pool-realtime-and-auth)
- [Mering & Jest](#merging--jest)
- [Funnels & User Stories](#funnels--user-stories)
- [Roadmap](#roadmap)
- [Product Positioning](#product-positioning)


- [Inspiration](#inspiration)
- [For AI](#for-AI)



<br>

---

# Tech Stack

| Area            | Choice                           |
|-----------------|----------------------------------|
| Frontend & API  | **Next.js (React)** (TypeScript) |
| Styling         | **Tailwind CSS**                 |
| State (client)  | **Zustand**                      |
| Database        | **Postgres (Supabase)**          |
| Data Access     | **`pg`**                         |
| Realtime/Status | **Supabase Realtime**            |
| Pooling         | **Supabase Pooler with pg**      |
| Auth            | **Supabase Auth (admin only)**   |
| Storage         | **Supabase Storage**             |
| Payments        | **Mercado Pago**                 |
| Location        | **Google GeoCoding, Nominatim**  |
| Deployment      | **Vercel**                       |
| Language        | **Only PT-BR, no i18n**          |
| UX Prototyping  | **Figma**                        |
| UI Prototyping  | **Photoshop**                    |
| Tests           | **Jest + Github Actions**        |
| Metrics         | **Posthog + Clarity**            |
| Error Handling  | **Sentry**                       |

## Future Additions: (Ignore)

| Deferred component                     | When to add                              | Trigger / signal                                     | Migration notes                                              |
| -------------------------------------- |------------------------------------------| ---------------------------------------------------- | ------------------------------------------------------------ |
| **NestJS backend**                     | Only if API complexity explodes          | Many services, queues, custom guards                 | Can coexist behind `/api` gateway or move routes over time   |
| **AWS S3**                             | If storage costs/limits on Supabase bite | Heavy media, CDN needs                               | Migrate via background copy; keep URLs via proxy             |
| **Stripe (second processor)**          | When you want redundancy or new methods  | Chargebacks/acceptance or geo coverage               | Keep a provider abstraction; add per-provider webhooks       |
| **WebSockets / Socket.IO**             | If realtime scale/latency needs grow     | >1k concurrent order listeners; fine-grained streams | Start with Supabase Realtime; swap channels to sockets later |
| **Sentry (error monitoring)**          | As traffic and edge cases rise           | Hard-to-repro prod errors                            | Drop-in SDK; map request IDs to logs                         |
| **Full i18n** (`next-intl`)            | When expanding markets                   | Non-PT users or SEO in other locales                 | Externalize copy; start with route-level locales             |
| **Customer accounts** (Supabase Auth)  | When retention features matter           | Saved addresses, order history                       | Keep guest orders; link retroactively via email              |
| **Analytics dashboard**                | When operators need insight              | Questions like “best-selling items by hour?”         | Start with SQL views; add charts later                       |
| **Stripe Webhooks + advanced billing** | When subscriptions/complex billing       | Multi-location, refunds automation                   | Isolate webhook handlers in `/api/webhooks/*`                |
| **ORM (Prisma/Drizzle)**               | If team prefers models/migrations        | Many devs; frequent schema changes                   | Introduce gradually; generate types from existing schema     |
| **CI/CD extras** (lint, tests matrix)  | As team grows                            | PR churn, regressions                                | Start with lint + a few integration tests                    |






<br>

---

# Folder Structure

Each folder has a README, and for each one of the files inside the folder (including other folders) it has:
- **What it does:** What the file/folder does
- **How:** How does he achieve that
- **Usage:** How can we use it (mostly used in lib README)


> Frequent files may be ignored or only explained once.

## Root Folder Explanation
### /app
The app universal root.

### /lib
Centralized reusable *code*. Includes a README explaining how to use it all.

### /components
Centralized reusable front-end components.
#### /components/ui
Reusable UI Components (buttons, inputs, etc). Full showcase at localhost:3000/dev/ui, implementation documentation at /components/ui/README.md

### /public
Images, fonts, etc used by the /app



<br>

---

# Database, Pool, Realtime and Auth
## 1. Database
All database connections are done via **Pool, Auth, Realtime or Normal Requests**. Through ```lib/sql.ts``` and ```lib/supabaseClient.ts``` usage.

## 2. Pool (for Back-end)
Pooling is the action of grouping multiple requests to the Database in a single line, called Pool. The pooling is done every X seconds, so it's ideal if something refreshes every 30 seconds or so.

### What it does:
**Talks to the Database**, if and only if you are in Back-end.

### How:
```lib/sql.ts``` has a **Helper Function** used by all files to do any Database Requests by the Back-end.

### Usage:
```lib/README.md``` explains how to use Pool.

## 3. Realtime (for Front-end)
Realtime is when a variable is directly connected to a Table in the Database. If that Table updates, the variable updates in Real Time.

> This connection is one-way only: **Database** → **Updates Front-end Variables**.

### What it does:
**Quickly talks to the Database**, for short requests. If and only if you are in Front-end.

### How:
```lib/supabaseClient.ts``` has a **Helper Function** used by all files to do any Realtime Requests.

### Usage:
```lib/README.md``` explains how to use Realtime.

## 3. Auth (for Front-end)

> This connection doesn't use the Database (Postgres), it's a Supabase service.

### What it does:
**Stores and validate user accounts**. If and only if you are in Front-end.

### How:
```lib/supabaseClient.ts``` has a **Helper Function** used by all files to do Auth Requests.

### Usage:
```lib/README.md``` explains how to use Auth.

<br>

---

# Merging & Jest

Done via GitHub Actions



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


<br>

---

# Inspiration

- Layout: iFood
	- Lesser Friction
- Functionalities (future): https://www.mydigimenu.com/



<br>

---

# For AI

Follow those rules:

- Do not add any uneeded libraries or apps, do not add any uneeded code 
- Review the attached files thoroughly. If there is anything you need referenced that’s missing, ask for it. 
- If you’re unsure about any aspect of the task, ask for clarification. Don’t guess. Don’t make assumptions. 
- Always preserve everything from the original files, except for what is being updated.
- Write code in full with no placeholders. If you get cut off, I’ll say “continue”
- DO NOT add any extras do the code, only what was requested.
- IMPORTANT: These files are going to be merged constantly, so DO NOT change variable names. Always check the current code the update/change it.

<br>

---
