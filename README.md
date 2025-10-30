# Summary

> We must be better in every single aspect

- [Tech Stack](#tech-stack)
- [MVP Roadmap](#mvp-roadmap)
- [Folder Structure](#folder-structure)
- [Database, Pool, Realtime and Auth](#database-pool-realtime-and-auth)

- [Inspiration](#inspiration)
- [For AI](#for-AI)



<br>

---

# Tech Stack

| Area              | Choice                           |
|-------------------|----------------------------------|
| Frontend & API    | **Next.js (React)** (TypeScript) |
| Styling           | **Tailwind CSS**                 |
| State (client)    | **Zustand**                      |
| Database          | **Postgres (Supabase)**          |
| Data Access       | **`pg`**                         |
| Realtime/Status   | **Supabase Realtime**            |
| Pooling           | **Supabase Pooler with pg**      |
| Auth              | **Supabase Auth (admin only)**   |
| Storage           | **Supabase Storage**             |
| Migrations        | **Manual**                       |
| Payments          | **Mercado Pago**                 |
| Deployment        | **Vercel**                       |
| Monitoring/Logs   | **Basic Vercel logs**            |
| Language          | **Only PT-BR, no i18n**          |
| UX Prototyping    | **Figma**                        |
| UI Prototyping    | **Photoshop** (or Figma, if fine)|

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

# MVP Roadmap

## 🍔 Customer Side (the public “menu” app)

| Feature                                                         | Interaction with Stack                                                                                                                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Menu page (categories, items, images, prices, availability)** | **React (Next.js)** fetches menu data via **API from NestJS**, which queries **Supabase (PostgreSQL)** directly using **pg**. Images are stored in **AWS S3**, and their URLs are returned via the API. |
| **Cart (add/remove/edit items, dynamic pricing)**               | Handled by **Zustand** on the client (React state). Prices fetched from DB; totals calculated locally; persisted temporarily in browser storage.                                                        |
| **Checkout flow (address, payment, confirmation)**              | **React form** → submits to **NestJS API** → creates `order` in **Supabase** + calls **Stripe/Mercado Pago API** for payment → webhook confirms success → updates order status in DB.                   |
| **Real-time order status (preparing → delivering → done)**      | Frontend subscribes to **Supabase Realtime** or **WebSocket (NestJS + Socket.IO)** channels for order status changes.                                                                                   |
| **Login / signup (optional for guests)**                        | **Supabase Auth** manages session tokens; Next.js fetches current user via cookie/session.                                                                                                              |
| **Language toggle (pt/en)**                                     | **next-intl** or **next-translate** switches text keys and loads translation JSONs.                                                                                                                     |
| **Responsive design (mobile-first)**                            | Built with **TailwindCSS** breakpoints and Next.js responsive layout components.                                                                                                                        |



## 🏪 Restaurant Admin Dashboard

| Feature                                              | Interaction with Stack                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication / restaurant login**                | Uses **Supabase Auth** (role = restaurant). Backend validates JWT tokens in NestJS middleware.                                        |
| **Menu management (add/edit/delete, upload photos)** | Dashboard (React) sends CRUD requests to **NestJS API** → backend executes **SQL via pg** on **Supabase** → image files go to **S3**. |
| **Category management (e.g., Burgers, Drinks)**      | Similar CRUD flow: React → NestJS → SQL via **pg** → Supabase.                                                                        |
| **Order management (view/update status)**            | **NestJS API** exposes endpoints + **WebSocket/Supabase Realtime** for instant updates to open orders.                                |
| **Schedule management (open/closed)**                | Stored as flags in restaurant table; toggled through API → used by frontend to show “closed” banner or disable checkout.              |
| **Analytics dashboard (sales, best items)**          | Next.js calls **NestJS analytics endpoints**, which run **raw SQL aggregations** via **pg** on Supabase.                              |
| **Profile management (info, fees, logo, banner)**    | CRUD via API; images stored in **S3**; text data in **Supabase**.                                                                     |


## ⚙️ System / Backend Functions

| Function                                                   | Interaction with Stack                                                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **User authentication (JWT / Supabase Auth)**              | Supabase handles sign-in & tokens; NestJS verifies JWT in each request middleware.                         |
| **CRUD APIs (restaurants, menus, orders, users)**          | Implemented in **NestJS** controllers + raw SQL queries (via **pg** pool) against Supabase PostgreSQL.     |
| **Payment integration (MP / Stripe webhook handling)**     | **NestJS** routes receive payment confirmations from gateway webhooks; update `orders` in Supabase.        |
| **File uploads (menu images → S3)**                        | Frontend gets pre-signed upload URL from NestJS → uploads directly to **AWS S3** → URL saved in DB.        |
| **Real-time order status (Socket.IO / Supabase Realtime)** | **NestJS Gateway** (WebSocket) or Supabase triggers notify connected clients instantly.                    |
| **Notifications (email, push, in-app)**                    | **NestJS background service** (e.g., BullMQ queue) + providers like Resend / FCM / Socket events.          |
| **Error logging (Sentry)**                                 | Integrated in both **Next.js** and **NestJS**; automatically captures exceptions and sends them to Sentry. |
| **Translations (i18n setup)**                              | **next-intl** for frontend; **nestjs-i18n** for backend; share translation keys or JSONs.                  |
| **Database migrations & backups (manual / Supabase)**      | Schema created & managed through **Supabase SQL Editor**; Supabase handles **automatic daily backups**.    |




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
Centralized reusable code. Includes a README explaining how to use it all.





<br>

---

# Database, Pool, Realtime and Auth
## 1. Database
All database connections are done via **Pool, Auth or Realtime**. Through ```lib/sql.ts``` and ```lib/supabaseClient.ts``` usage.


## 2. Pool (for Back-end)
Pooling is the action of grouping multiple requests to the Database in a single line, called Pool.

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
