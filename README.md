# Summary

> We must be better in every single aspect

- [Tech Stack](#tech-stack)
- [Folder Structure](#folder-structure)
- [Database, Pool, Realtime and Auth](#database-pool-realtime-and-auth)
- [Merging & Jest](#merging--jest)
- [Funnels & User Stories](#funnels--user-stories)
- [Roadmap](#roadmap)
- [Product Positioning](#product-positioning)
 

- [Inspiration](#inspiration)
- [For AI](#for-AI)



<br>

---

# Tech Stack

| Area | Current implementation |
| --- | --- |
| Frontend and API | Next.js 16 App Router, React 19 and TypeScript |
| Styling | Tailwind CSS 4, shared components in `components/ui/` |
| Client state | Zustand |
| Database | PostgreSQL 17 in self-hosted Supabase on the VPS |
| Server data access | `pg` connection pool via `lib/database/db.ts` and `lib/database/sql.ts` |
| Auth, Realtime and Storage | Supabase Auth, Realtime and Storage |
| Payments | Mercado Pago, PayZu and Asaas integrations |
| Location | Geocoding helpers and external location providers |
| Deployment | Docker on the KingHost VPS, with GitHub Actions releases for preview and production |
| Tests and quality checks | Jest, TypeScript and Next.js build in GitHub Actions |
| Analytics and monitoring | PostHog and Sentry instrumentation |
| Product language | PT-BR |

For operational details and verified infrastructure, see [VPS operations](deployment/vps/README.md). For current working rules, see [AGENTS.md](AGENTS.md).

## Historical ideas (not the current architecture or an approved migration plan)

| Deferred component                     | When to add                              | Trigger / signal                                     | Migration notes                                              |
| -------------------------------------- |------------------------------------------| ---------------------------------------------------- | ------------------------------------------------------------ |
| **NestJS backend**                     | Only if API complexity explodes          | Many services, queues, custom guards                 | Can coexist behind `/api` gateway or move routes over time   |
| **AWS S3**                             | If storage costs/limits on Supabase bite | Heavy media, CDN needs                               | Migrate via background copy; keep URLs via proxy             |
| **Stripe (second processor)**          | When you want redundancy or new methods  | Chargebacks/acceptance or geo coverage               | Keep a provider abstraction; add per-provider webhooks       |
| **WebSockets / Socket.IO**             | If realtime scale/latency needs grow     | >1k concurrent order listeners; fine-grained streams | Start with Supabase Realtime; swap channels to sockets later |
| **Full i18n** (`next-intl`)            | When expanding markets                   | Non-PT users or SEO in other locales                 | Externalize copy; start with route-level locales             |
| **Customer accounts** (Supabase Auth)  | When retention features matter           | Saved addresses, order history                       | Keep guest orders; link retroactively via email              |
| **Stripe Webhooks + advanced billing** | When subscriptions/complex billing       | Multi-location, refunds automation                   | Isolate webhook handlers in `/api/webhooks/*`                |
| **ORM (Prisma/Drizzle)**               | If team prefers models/migrations        | Many devs; frequent schema changes                   | Introduce gradually; generate types from existing schema     |
| **CI/CD extras** (lint, tests matrix)  | As team grows                            | PR churn, regressions                                | Start with lint + a few integration tests                    |






<br>

---

# Folder Structure

The current repository follows Next.js App Router conventions; URL folders in `app/api/` do **not** have to match database table names.

- `app/`: pages, layouts and API routes. `app/painel/` contains restaurant-owner pages; `app/[slug]/` contains the public menu; `app/restaurante/` handles registration and setup; `app/(extra)/` groups additional routes without changing their URLs.
- `app/api/`: HTTP endpoints grouped by route and functionality, including `cron/`, `orders/`, `ia-vendas/` and `webhooks/`.
- `components/ui/`: shared UI controls; `components/restaurant-owner/`, `components/costumer/`, `components/dev/` and other feature folders contain their own components (these are existing folder names).
- `lib/`: domain utilities and integrations in `database/`, `stores/`, `services/`, `ia-vendas/`, `payments/`, `analytics/` and other feature folders.
- `public/`: static fonts, icons, images and other served assets.
- `deployment/vps/`: Docker deployment scripts and operational documentation.
- `docs/`: focused technical documentation and the [UI guidance](docs/ai-design-guidelines.md).

Use the current file tree and existing imports as the source of truth. This is a description of the current layout, **not** a mandate to rename or reorganize files.

# Database, Pool, Realtime and Auth

## PostgreSQL and server-side queries

The backend uses a PostgreSQL connection pool in `lib/database/db.ts`, accessed through `query` and transaction utilities in `lib/database/sql.ts`. Connections are acquired, reused and released per operation; pooling does **not** batch database requests every few seconds. Keep database credentials on the server.

## Supabase services

The app uses self-hosted Supabase for PostgreSQL, authentication, storage and realtime events. The browser client in `lib/database/supabaseClient.ts` supports Auth, Realtime and existing client-side Supabase operations subject to access policies. Server-side access uses `lib/database/sql.ts` or server clients such as `lib/database/supabaseServerClient.ts` where appropriate.

Both direct, policy-controlled client requests and backend API routes exist today. Do not assume all data goes through Zustand or that all Supabase access goes through API routes.

See [VPS operations](deployment/vps/README.md) for live infrastructure and security details.

# Merging & Jest

`preview` is the development branch; `main` is production. Follow [AGENTS.md](AGENTS.md) for branch safeguards and change requirements.

The [Validate build workflow](.github/workflows/validate-build.yml) runs `npm ci`, targeted Jest suites, `npx tsc --noEmit` and `npx next build` on pushes to `preview`. Pull requests into `main` have a TypeScript check. GitHub Actions also handles VPS deployments; see [deployment/vps/README.md](deployment/vps/README.md).

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

*Historical product planning notes, not a current implementation checklist or approved task list.*

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

Follow [AGENTS.md](AGENTS.md) as the authoritative source for repository access, scope, code changes, branch safeguards and validation. For frontend work, also read [docs/ai-design-guidelines.md](docs/ai-design-guidelines.md), using [design-system.html](design-system.html) as the visual reference when needed.
